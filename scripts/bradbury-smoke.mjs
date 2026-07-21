import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "genlayer-js";
import { testnetBradbury } from "genlayer-js/chains";
import { TransactionStatus } from "genlayer-js/types";
import { privateKeyToAccount } from "viem/accounts";
import { Wallet } from "ethers";

const contractAddress = process.argv[2];
if (!/^0x[a-fA-F0-9]{40}$/.test(contractAddress || "")) {
  throw new Error("Usage: npm run smoke:bradbury -- <contract-address>");
}

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
if (!env.ACCOUNT_PRIVATE_KEY || !env.CLAUSEFLOW_KEYSTORE_PASSWORD) throw new Error("Missing local smoke-test credentials");

const builder = privateKeyToAccount(env.ACCOUNT_PRIVATE_KEY);
if (env.EXPECTED_WALLET_ADDRESS && builder.address.toLowerCase() !== env.EXPECTED_WALLET_ADDRESS.toLowerCase()) {
  throw new Error("Builder key does not match EXPECTED_WALLET_ADDRESS");
}
console.log(`SMOKE_BUILDER_READY ${builder.address}`);
const clientKeystore = readFileSync(join(process.env.USERPROFILE, ".genlayer", "keystores", "ClauseFlow-client-demo.json"), "utf8");
console.log("SMOKE_CLIENT_KEYSTORE_READ");
const clientWallet = await Wallet.fromEncryptedJson(clientKeystore, env.CLAUSEFLOW_KEYSTORE_PASSWORD);
const client = privateKeyToAccount(clientWallet.privateKey);
console.log(`SMOKE_CLIENT_READY ${client.address}`);
const sdk = createClient({ chain: testnetBradbury });
const estimateTransactionGas = sdk.estimateTransactionGas.bind(sdk);
sdk.estimateTransactionGas = async (args) => {
  const estimate = await estimateTransactionGas(args);
  return (estimate * 3n) + 500_000n;
};

const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function read(functionName, args = []) {
  let lastError;
  for (let attempt = 1; attempt <= 12; attempt += 1) {
    try {
      return await sdk.readContract({ address: contractAddress, functionName, args });
    } catch (error) {
      lastError = error;
      const message = error instanceof Error ? error.message : String(error);
      if (!message.includes("Internal error") || attempt === 12) throw error;
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

async function waitForReceipt(hash, status, retries) {
  let lastError;
  for (let attempt = 1; attempt <= 12; attempt += 1) {
    try {
      return await sdk.waitForTransactionReceipt({ hash, status, interval: 5_000, retries });
    } catch (error) {
      lastError = error;
      const message = error instanceof Error ? error.message : String(error);
      if (!message.includes("Internal error") || attempt === 12) throw error;
      console.log(`RETRY receipt ${hash} after transient RPC error (${attempt}/12)`);
      await delay(5_000);
    }
  }
  throw lastError;
}

async function write(account, functionName, args = [], value = 0n) {
  const aiMethod = functionName === "structure_offer";
  const aiFees = {
    distribution: {
      leaderTimeunitsAllocation: "500",
      validatorTimeunitsAllocation: "500",
      rotations: ["0", "1", "2", "3", "4"]
    }
  };
  const params = { account, address: contractAddress, functionName, args, value, consensusMaxRotations: 5 };
  console.log(`WRITE_START ${functionName}`);
  const hash = await sdk.writeContract(aiMethod ? { ...params, fees: aiFees } : params);
  console.log(`TX ${functionName} ${hash}`);
  const receipt = await waitForReceipt(hash, TransactionStatus.ACCEPTED, 360);
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
      const message = error instanceof Error ? error.message : String(error);
      if (!message.includes("Internal error") || transientFailures >= 12) throw error;
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
  "Verify existing public Mochi-Game evidence for a ClauseFlow dashboard payment proof. No new implementation work is requested.",
  "Confirm the already-published Mochi-Game live app and GitHub README are publicly accessible and relevant to the Quest Evaluator flow.",
  "Live app URL, GitHub README URL, and short delivery note listing those public evidence links.",
  "Approve if validators can fetch the live app or README and confirm they reference Mochi-Game, Quest Evaluator, GenLayer consensus, or demo autofill. Do not require new code, audits, PRs, reviewer checklists, or README changes.",
  price,
  2n,
  1n,
  24n,
  24n,
  refundRule,
];

const refundArgs = (title, price) => [
  title,
  "Verify an intentionally unavailable ClauseFlow evidence URL for refund-path testing.",
  "Confirm whether the submitted delivery URL is publicly accessible and contains the promised ClauseFlow evidence.",
  "A public HTTPS delivery URL containing the promised ClauseFlow evidence.",
  "Reject if validators cannot fetch the delivery URL or cannot find the promised evidence on the fetched page.",
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
  await write(builder, "publish_offer", [...args, "https://github.com/tanphung/Mochi-Game\nhttps://mochi-game-frontend.vercel.app"]);
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
    await write(builder, "submit_delivery", [dealId, "https://mochi-game-frontend.vercel.app", "https://github.com/tanphung/Mochi-Game", "https://mochi-game-frontend.vercel.app", "https://github.com/tanphung/Mochi-Game#readme", "Mochi-Game evidence package: live app, GitHub repository, README checklist, and Quest Evaluator flow are public for GenLayer validators to fetch and compare against the accepted agreement."]);
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
    await write(builder, "submit_delivery", [dealId, "https://clauseflow-evidence.invalid", "", "", "", "Submitted URL is intentionally unavailable for refund-path verification."]);
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

console.log(`SMOKE builder=${builder.address} client=${client.address} contract=${contractAddress}`);

const paymentPrice = 20_000_000_000_000_000n;
const paymentOffer = await createOffer("ClauseFlow verified payment flow", paymentArgs("ClauseFlow verified payment flow", paymentPrice));
const paymentDeal = await fundOffer(paymentOffer, paymentPrice);
await completePayment(paymentDeal);

const refundPrice = 15_000_000_000_000_000n;
const refundOffer = await createOffer("ClauseFlow verified refund flow", refundArgs("ClauseFlow verified refund flow", refundPrice));
const refundDeal = await fundOffer(refundOffer, refundPrice);
await completeRefund(refundDeal);

const stats = await readJson("get_dashboard_stats");
if (stats.completedDeals !== "2" || stats.totalPaidAtto !== String(paymentPrice) || stats.totalRefundedAtto !== String(refundPrice)) {
  throw new Error(`Unexpected final stats ${JSON.stringify(stats)}`);
}
console.log(`SMOKE_OK paymentDeal=${paymentDeal} refundDeal=${refundDeal} stats=${JSON.stringify(stats)}`);
