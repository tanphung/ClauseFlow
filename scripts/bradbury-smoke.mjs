import { readFileSync } from "node:fs";
import { abi, createClient } from "genlayer-js";
import { testnetBradbury } from "genlayer-js/chains";
import { TransactionStatus } from "genlayer-js/types";
import { privateKeyToAccount } from "viem/accounts";
import { createPublicClient, encodeFunctionData, formatEther, http, parseEventLogs } from "viem";

const contractAddress = process.argv[2];
if (!/^0x[a-fA-F0-9]{40}$/.test(contractAddress || "")) {
  throw new Error("Usage: npm run smoke:bradbury -- <contract-address> [preflight|refund-only|full]");
}
const mode = process.argv[3] || "full";
if (!["preflight", "refund-only", "full"].includes(mode)) throw new Error(`Unknown smoke mode: ${mode}`);

console.log(`SMOKE_BOOT contract=${contractAddress}`);
const env = Object.fromEntries(
  readFileSync(".env", "utf8")
    .split(/\r?\n/)
    .filter((line) => /^\s*[A-Za-z_][A-Za-z0-9_]*\s*=/.test(line))
    .map((line) => {
      const index = line.indexOf("=");
      return [line.slice(0, index).trim(), line.slice(index + 1).trim().replace(/^['\"]|['\"]$/g, "")];
    })
);
const builderKey = env.CLAUSEFLOW_BUILDER_PRIVATE_KEY || env.ClauseFlow2_PRIVATE_KEY || env.ACCOUNT1_PRIVATE_KEY || env.ACCOUNT_PRIVATE_KEY;
const clientKey = env.CLAUSEFLOW_CLIENT_PRIVATE_KEY || env.ClauseFlow3_PRIVATE_KEY;
if (!/^0x[a-fA-F0-9]{64}$/.test(builderKey || "") || !/^0x[a-fA-F0-9]{64}$/.test(clientKey || "")) {
  throw new Error("Missing valid Builder/Client private keys. Set CLAUSEFLOW_BUILDER_PRIVATE_KEY and CLAUSEFLOW_CLIENT_PRIVATE_KEY, or ClauseFlow2_PRIVATE_KEY and ClauseFlow3_PRIVATE_KEY.");
}

const builder = privateKeyToAccount(builderKey);
const client = privateKeyToAccount(clientKey);
if (builder.address.toLowerCase() === client.address.toLowerCase()) throw new Error("Builder and Client must use different wallets");
if (env.ClauseFlow2_ADDRESS && builder.address.toLowerCase() !== env.ClauseFlow2_ADDRESS.toLowerCase()) throw new Error("Builder key does not match ClauseFlow2_ADDRESS");
if (env.ClauseFlow3_ADDRESS && client.address.toLowerCase() !== env.ClauseFlow3_ADDRESS.toLowerCase()) throw new Error("Client key does not match ClauseFlow3_ADDRESS");

const publicClient = createPublicClient({ chain: testnetBradbury, transport: http() });
const [builderBalance, clientBalance] = await Promise.all([
  publicClient.getBalance({ address: builder.address }),
  publicClient.getBalance({ address: client.address })
]);
console.log(`SMOKE_BUILDER_READY address=${builder.address} balance=${formatEther(builderBalance)} GEN`);
console.log(`SMOKE_CLIENT_READY address=${client.address} balance=${formatEther(clientBalance)} GEN`);
if (mode === "preflight") {
  console.log("SMOKE_PREFLIGHT_OK");
} else {
  await runSmoke();
}

async function runSmoke() {
const sdk = createClient({ chain: testnetBradbury });

const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
const isTransientRpcError = (error) => /internal error|fetch failed|econnreset|etimedout|network error|socket hang up/i.test(
  error instanceof Error ? error.message : String(error)
);

async function submitContractWrite(account, functionName, args, value) {
  const consensus = testnetBradbury.consensusMainContract;
  if (!consensus?.address || !consensus.abi) throw new Error("Bradbury consensus contract configuration is unavailable");
  const appCalldata = abi.calldata.encode(abi.calldata.makeCalldataObject(functionName, args));
  const serializedData = abi.transactions.serialize([appCalldata, false]);
  const encodedData = encodeFunctionData({
    abi: consensus.abi,
    functionName: "addTransaction",
    args: [
      account.address,
      contractAddress,
      testnetBradbury.defaultNumberOfInitialValidators,
      5,
      serializedData,
      BigInt(Math.floor(Date.now() / 1000) + 3600)
    ]
  });
  const [nonce, gasPrice] = await Promise.all([
    publicClient.getTransactionCount({ address: account.address }),
    publicClient.getGasPrice()
  ]);
  const serializedTransaction = await account.signTransaction({
    to: consensus.address,
    data: encodedData,
    value,
    gas: 5_000_000n,
    gasPrice,
    nonce,
    chainId: testnetBradbury.id,
    type: "legacy"
  });
  const evmHash = await publicClient.sendRawTransaction({ serializedTransaction });
  const receipt = await publicClient.waitForTransactionReceipt({ hash: evmHash });
  if (receipt.status !== "success") throw new Error(`Consensus activation reverted after using ${receipt.gasUsed} gas: ${evmHash}`);
  const events = parseEventLogs({ abi: consensus.abi, logs: receipt.logs, strict: false });
  const created = events.find((event) => event.eventName === "NewTransaction" || event.eventName === "CreatedTransaction");
  const txId = created?.args?.txId;
  if (typeof txId !== "string") throw new Error(`Consensus activation ${evmHash} did not emit a transaction ID`);
  console.log(`EVM_ACTIVATION ${functionName} ${evmHash} gasUsed=${receipt.gasUsed}`);
  return txId;
}

async function read(functionName, args = []) {
  let lastError;
  for (let attempt = 1; attempt <= 12; attempt += 1) {
    try {
      return await sdk.readContract({ address: contractAddress, functionName, args });
    } catch (error) {
      lastError = error;
      if (!isTransientRpcError(error) || attempt === 12) throw error;
      console.log(`RETRY view ${functionName} after transient RPC error (${attempt}/12)`);
      await delay(5_000);
    }
  }
  throw lastError;
}

const readJson = async (functionName, args = []) => {
  const value = await read(functionName, args);
  return typeof value === "string" ? JSON.parse(value) : value;
};

async function waitForAcceptedExecution(hash, retries = 360) {
  let transientFailures = 0;
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    let transaction;
    try {
      transaction = await sdk.getTransaction({ hash });
      transientFailures = 0;
    } catch (error) {
      if (!isTransientRpcError(error) || transientFailures >= 12) throw error;
      transientFailures += 1;
      await delay(5_000);
      continue;
    }
    const status = transaction.statusName;
    const execution = transaction.txExecutionResultName;
    if (["UNDETERMINED", "CANCELED", "VALIDATORS_TIMEOUT", "LEADER_TIMEOUT"].includes(status)) {
      throw new Error(`Transaction ${hash} ended with status=${status} execution=${execution}`);
    }
    if (["ACCEPTED", "READY_TO_FINALIZE", "FINALIZED"].includes(status) && execution !== "NOT_VOTED") {
      return transaction;
    }
    if (attempt % 12 === 0) console.log(`WAIT execution ${hash} status=${status} execution=${execution}`);
    await delay(5_000);
  }
  throw new Error(`Transaction ${hash} did not produce an execution result`);
}

async function waitForReceipt(hash, status, retries) {
  let lastError;
  for (let attempt = 1; attempt <= 12; attempt += 1) {
    try {
      return await sdk.waitForTransactionReceipt({ hash, status, interval: 5_000, retries });
    } catch (error) {
      lastError = error;
      if (!isTransientRpcError(error) || attempt === 12) throw error;
      console.log(`RETRY receipt ${hash} after transient RPC error (${attempt}/12)`);
      await delay(5_000);
    }
  }
  throw lastError;
}

async function write(account, functionName, args = [], value = 0n) {
  console.log(`WRITE_START ${functionName}`);
  const hash = await submitContractWrite(account, functionName, args, value);
  console.log(`TX ${functionName} ${hash}`);
  const receipt = await waitForAcceptedExecution(hash, 360);
  if (receipt.txExecutionResultName !== "FINISHED_WITH_RETURN") {
    throw new Error(`${functionName} execution=${receipt.txExecutionResultName}`);
  }
  if (!["AGREE", "MAJORITY_AGREE"].includes(receipt.resultName)) {
    throw new Error(`${functionName} consensus=${receipt.resultName}`);
  }
  return { hash, receipt };
}

async function waitForFinalizationReady(hash) {
  let transientFailures = 0;
  for (let attempt = 1; attempt <= 720; attempt += 1) {
    let transaction;
    try {
      transaction = await sdk.getTransaction({ hash });
      transientFailures = 0;
    } catch (error) {
      if (!isTransientRpcError(error) || transientFailures >= 12) throw error;
      transientFailures += 1;
      console.log(`RETRY tx status ${hash} after transient RPC error (${transientFailures}/12)`);
      await delay(5_000);
      continue;
    }
    if (transaction.statusName === TransactionStatus.FINALIZED) return "already_finalized";
    if (transaction.statusName === TransactionStatus.READY_TO_FINALIZE) return "ready";
    if (attempt % 12 === 0) console.log(`WAIT finalize window ${hash} status=${transaction.statusName}`);
    await delay(5_000);
  }
  throw new Error(`Transaction ${hash} did not become ready to finalize`);
}

async function finalizeParentTransaction(hash, account) {
  const readiness = await waitForFinalizationReady(hash);
  if (readiness === "already_finalized") return;
  let evmHash;
  for (let attempt = 1; attempt <= 12; attempt += 1) {
    try {
      evmHash = await sdk.finalizeTransaction({ account, txId: hash });
      break;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!message.includes("Internal error") || attempt === 12) throw error;
      console.log(`RETRY finalize ${hash} after transient RPC error (${attempt}/12)`);
      await delay(5_000);
    }
  }
  console.log(`FINALIZE ${hash} evm=${evmHash}`);
  await waitForReceipt(hash, TransactionStatus.FINALIZED, 120);
}

const refundRule = "Client may claim a refund after deadline plus grace period, or after rejected evidence.";
const paymentArgs = (title, price) => [
  title,
  "Deliver a public ClauseFlow release-verification package for a Client to inspect before accepting the release.",
  "Provide direct public access to the deployed ClauseFlow interface, its source repository, and the project README so a Client can independently verify that the release exists, is usable, and is documented.",
  "A live ClauseFlow dashboard, a public GitHub repository containing the contract and frontend source, and a reviewer README with setup and on-chain workflow documentation.",
  "Approve only when validators independently fetch a usable live ClauseFlow interface, a public repository containing the intelligent contract and frontend source, and a README that documents setup and the on-chain agreement workflow. The sources must describe the same ClauseFlow release.",
  price,
  2n,
  1n,
  24n,
  24n,
  refundRule,
];

const refundArgs = (title, price) => [
  title,
  "Deliver a complete public accessibility audit for the ClauseFlow agreement dashboard.",
  "Publish an audit that documents keyboard navigation, visible focus, color contrast, and actionable remediation for the public ClauseFlow dashboard.",
  "A public accessibility audit report, the live ClauseFlow dashboard, and repository evidence supporting each finding.",
  "Approve only if validators can fetch a dedicated public audit report that contains keyboard navigation, focus visibility, contrast, and remediation findings tied to ClauseFlow. Reject evidence that only links the app or repository without the required audit.",
  price,
  2n,
  1n,
  24n,
  24n,
  refundRule,
];

async function createOffer(title, args) {
  const price = args[5];
  const offerIds = await readJson("get_offer_ids");
  for (const offerId of offerIds) {
    const offer = await readJson("get_offer", [offerId]);
    if (offer.title === title && offer.builder.toLowerCase() === builder.address.toLowerCase()) {
      console.log(`RESUME published offer ${offerId} for ${title}`);
      return offerId;
    }
  }
  let draft;
  const stored = await read("get_structured_offer", [builder.address]);
  if (typeof stored === "string" && stored.length > 0) draft = JSON.parse(stored);
  if (draft?.title === title && draft.priceAttoGen === String(price) && draft.publishedOfferId) {
    console.log(`RESUME published offer ${draft.publishedOfferId} for ${title}`);
    return draft.publishedOfferId;
  }
  if (!draft || draft.title !== title || draft.priceAttoGen !== String(price)) {
    await write(builder, "structure_offer", args);
    draft = await waitForStructuredDraft(title, price);
  } else {
    console.log(`RESUME structured draft for ${title}`);
  }
  if (!draft?.clauses?.acceptanceCriteria || draft.publishedOfferId) throw new Error("Contract draft was not stored correctly");
  await write(builder, "publish_offer", [...args, "https://github.com/tanphung/ClauseFlow\nhttps://clauseflow-two.vercel.app"]);
  return await waitForLastId("get_offer_ids");
}

async function fundOffer(offerId, price) {
  const dealIds = await readJson("get_deal_ids");
  for (const dealId of dealIds) {
    const deal = await readJson("get_deal", [dealId]);
    if (deal.offerId === offerId && deal.client.toLowerCase() === client.address.toLowerCase()) {
      console.log(`RESUME funded deal ${dealId} for offer ${offerId}`);
      return dealId;
    }
  }
  const stats = await readJson("get_dashboard_stats");
  if (BigInt(stats.contractBalanceAtto) > BigInt(stats.accountedEscrowAtto)) {
    throw new Error("A payable transaction is still pending; wait for it before funding another offer");
  }
  await write(client, "accept_offer", [offerId], price);
  return await waitForLastId("get_deal_ids");
}

async function waitForEscrowBalance(expectedAtto) {
  for (let attempt = 1; attempt <= 720; attempt += 1) {
    const stats = await readJson("get_dashboard_stats");
    if (BigInt(stats.contractBalanceAtto) <= BigInt(expectedAtto)) return;
    if (attempt % 12 === 0) console.log(`WAIT settlement balance <= ${expectedAtto}`);
    await delay(5_000);
  }
  throw new Error(`Settlement balance did not reach ${expectedAtto}`);
}

async function waitForDealStatus(dealId, expectedStatus) {
  for (let attempt = 1; attempt <= 60; attempt += 1) {
    const state = await readJson("get_deal", [dealId]);
    if (state.status === expectedStatus) return state;
    if (attempt % 6 === 0) console.log(`WAIT deal ${dealId} status=${expectedStatus} current=${state.status}`);
    await delay(5_000);
  }
  return await readJson("get_deal", [dealId]);
}

async function waitForStructuredDraft(title, price) {
  for (let attempt = 1; attempt <= 60; attempt += 1) {
    const stored = await read("get_structured_offer", [builder.address]);
    if (typeof stored === "string" && stored.length > 0) {
      const draft = JSON.parse(stored);
      if (draft.title === title && draft.priceAttoGen === String(price)) return draft;
    }
    if (attempt % 6 === 0) console.log(`WAIT structured draft ${title}`);
    await delay(5_000);
  }
  throw new Error(`Structured draft was not indexed for ${title}`);
}

async function waitForLastId(functionName) {
  for (let attempt = 1; attempt <= 60; attempt += 1) {
    const ids = await readJson(functionName);
    if (ids.length > 0) return ids.at(-1);
    if (attempt % 6 === 0) console.log(`WAIT ${functionName}`);
    await delay(5_000);
  }
  throw new Error(`${functionName} did not return an id`);
}

async function completePayment(dealId) {
  let state = await readJson("get_deal", [dealId]);
  if (state.status === "FUNDED" || state.status === "REVISION_REQUIRED") {
    await write(builder, "submit_delivery", [dealId, "https://clauseflow-two.vercel.app", "https://raw.githubusercontent.com/tanphung/ClauseFlow/main/contracts/clauseflow.py", "https://clauseflow-two.vercel.app", "https://raw.githubusercontent.com/tanphung/ClauseFlow/main/README.md", "ClauseFlow release-verification package: a usable live dashboard, the deployed intelligent contract source, and a reviewer README with setup and on-chain workflow documentation."]);
    state = await waitForDealStatus(dealId, "SUBMITTED");
  }
  if (state.status === "SUBMITTED") {
    await write(builder, "review_delivery", [dealId]);
    state = await waitForDealStatus(dealId, "APPROVED");
  }
  if (state.status === "APPROVED") {
    const claim = await write(builder, "claim_payment", [dealId]);
    await finalizeParentTransaction(claim.hash, builder);
    state = await readJson("get_deal", [dealId]);
  }
  if (state.status === "PAYMENT_PENDING") {
    await waitForEscrowBalance(state.escrowAccountedAfterAtto);
    await write(builder, "confirm_payment", [dealId]);
    state = await waitForDealStatus(dealId, "PAID");
  }
  if (state.status !== "PAID") throw new Error(`Expected PAID, received ${state.status}`);
  return state;
}

async function completeRefund(dealId) {
  let state = await readJson("get_deal", [dealId]);
  if (state.status === "FUNDED" || state.status === "REVISION_REQUIRED") {
    await write(builder, "submit_delivery", [dealId, "https://clauseflow-two.vercel.app", "https://github.com/tanphung/ClauseFlow", "https://clauseflow-two.vercel.app", "https://raw.githubusercontent.com/tanphung/ClauseFlow/main/README.md", "The live dashboard and source are public, but no dedicated accessibility audit report has been published. This evidence package is intentionally submitted for the Client's evidence-based refund decision."]);
    state = await waitForDealStatus(dealId, "SUBMITTED");
  }
  if (state.status === "SUBMITTED") {
    await write(builder, "review_delivery", [dealId]);
    state = await waitForDealStatus(dealId, "REJECTED");
  }
  if (state.status === "REJECTED") {
    const claim = await write(client, "claim_refund", [dealId]);
    await finalizeParentTransaction(claim.hash, client);
    state = await readJson("get_deal", [dealId]);
  }
  if (state.status === "REFUND_PENDING") {
    await waitForEscrowBalance(state.escrowAccountedAfterAtto);
    await write(client, "confirm_refund", [dealId]);
    state = await waitForDealStatus(dealId, "REFUNDED");
  }
  if (state.status !== "REFUNDED") throw new Error(`Expected REFUNDED, received ${state.status}`);
  return state;
}

console.log(`SMOKE mode=${mode} builder=${builder.address} client=${client.address} contract=${contractAddress}`);

const baselineStats = await readJson("get_dashboard_stats");
const baselineCompleted = BigInt(baselineStats.completedDeals);
const baselinePaid = BigInt(baselineStats.totalPaidAtto);
const baselineRefunded = BigInt(baselineStats.totalRefundedAtto);

const paymentPrice = 20_000_000_000_000_000n;
let paymentDeal = "";
if (mode === "full") {
  const paymentOffer = await createOffer("ClauseFlow public release verification", paymentArgs("ClauseFlow public release verification", paymentPrice));
  paymentDeal = await fundOffer(paymentOffer, paymentPrice);
  await completePayment(paymentDeal);
}

const refundPrice = 15_000_000_000_000_000n;
const refundOffer = await createOffer("ClauseFlow accessibility audit agreement", refundArgs("ClauseFlow accessibility audit agreement", refundPrice));
const refundDeal = await fundOffer(refundOffer, refundPrice);
await completeRefund(refundDeal);

const stats = await readJson("get_dashboard_stats");
const expectedCompleted = baselineCompleted + (mode === "full" ? 2n : 1n);
const expectedPaid = baselinePaid + (mode === "full" ? paymentPrice : 0n);
const expectedRefunded = baselineRefunded + refundPrice;
if (BigInt(stats.completedDeals) !== expectedCompleted || BigInt(stats.totalPaidAtto) !== expectedPaid || BigInt(stats.totalRefundedAtto) !== expectedRefunded) {
  throw new Error(`Unexpected final stats ${JSON.stringify(stats)}`);
}
console.log(`SMOKE_OK mode=${mode} paymentDeal=${paymentDeal || "skipped"} refundDeal=${refundDeal} stats=${JSON.stringify(stats)}`);
}
