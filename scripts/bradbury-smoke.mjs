import { closeSync, mkdirSync, openSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { abi, createClient } from "genlayer-js";
import { testnetBradbury } from "genlayer-js/chains";
import { TransactionStatus } from "genlayer-js/types";
import { privateKeyToAccount } from "viem/accounts";
import { createPublicClient, encodeFunctionData, formatEther, http, parseEventLogs } from "viem";

const contractAddress = process.argv[2];
if (!/^0x[a-fA-F0-9]{40}$/.test(contractAddress || "")) {
  throw new Error("Usage: npm run smoke:bradbury -- <contract-address> [preflight|canary|payment-only|refund-only|full]");
}
const mode = process.argv[3] || "full";
const resumedPaymentDealId = process.argv[4] || "";
if (!["preflight", "canary", "payment-only", "refund-only", "full", "payment-revision", "payment-resume", "refund-resume", "appeal", "finalize-idle", "finalize"].includes(mode)) throw new Error(`Unknown smoke mode: ${mode}`);
if (mode === "payment-revision" && !/^\d+$/.test(resumedPaymentDealId)) {
  throw new Error("Usage: npm run smoke:bradbury -- <contract-address> payment-revision <deal-id>");
}
if (mode === "payment-resume" && !/^\d+$/.test(resumedPaymentDealId)) {
  throw new Error("Usage: npm run smoke:bradbury -- <contract-address> payment-resume <deal-id>");
}
if (mode === "refund-resume" && !/^\d+$/.test(resumedPaymentDealId)) {
  throw new Error("Usage: npm run smoke:bradbury -- <contract-address> refund-resume <deal-id>");
}
if (mode === "finalize" && !/^0x[a-fA-F0-9]{64}$/.test(resumedPaymentDealId)) {
  throw new Error("Usage: npm run smoke:bradbury -- <contract-address> finalize <transaction-hash>");
}
if (mode === "appeal" && !/^0x[a-fA-F0-9]{64}$/.test(resumedPaymentDealId)) {
  throw new Error("Usage: npm run smoke:bradbury -- <contract-address> appeal <transaction-hash>");
}
if (mode === "finalize-idle" && !/^0x[a-fA-F0-9]{64}$/.test(resumedPaymentDealId)) {
  throw new Error("Usage: npm run smoke:bradbury -- <contract-address> finalize-idle <transaction-hash>");
}

console.log(`SMOKE_BOOT contract=${contractAddress}`);
const runtimeDirectory = ".codex-runtime";
const lockPath = `${runtimeDirectory}/bradbury-smoke.lock`;
const checkpointPath = `${runtimeDirectory}/bradbury-smoke-${contractAddress.toLowerCase()}.json`;
mkdirSync(runtimeDirectory, { recursive: true });
acquireProcessLock();
process.on("exit", () => rmSync(lockPath, { force: true }));

let checkpoint = { contractAddress, mode, updatedAt: new Date().toISOString(), records: [] };
try {
  const stored = JSON.parse(readFileSync(checkpointPath, "utf8"));
  if (stored.contractAddress?.toLowerCase() === contractAddress.toLowerCase()) checkpoint = stored;
} catch {
  // A missing or incomplete checkpoint starts a new append-only local journal.
}

function acquireProcessLock() {
  try {
    const descriptor = openSync(lockPath, "wx");
    writeFileSync(descriptor, JSON.stringify({ pid: process.pid, contractAddress, mode, startedAt: new Date().toISOString() }));
    closeSync(descriptor);
  } catch (error) {
    let activePid = 0;
    try {
      activePid = Number(JSON.parse(readFileSync(lockPath, "utf8")).pid || 0);
      if (activePid > 0) process.kill(activePid, 0);
    } catch {
      rmSync(lockPath, { force: true });
      const descriptor = openSync(lockPath, "wx");
      writeFileSync(descriptor, JSON.stringify({ pid: process.pid, contractAddress, mode, startedAt: new Date().toISOString() }));
      closeSync(descriptor);
      return;
    }
    throw new Error(`Another Bradbury smoke process is active (pid=${activePid})`, { cause: error });
  }
}

function recordCheckpoint(record) {
  checkpoint = {
    ...checkpoint,
    mode,
    updatedAt: new Date().toISOString(),
    records: [...checkpoint.records, { ...record, recordedAt: new Date().toISOString() }],
  };
  writeFileSync(checkpointPath, JSON.stringify(checkpoint, null, 2));
}
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

const publicClient = createPublicClient({
  chain: testnetBradbury,
  transport: http(undefined, { timeout: 30_000, retryCount: 0 })
});
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
const isTransientRpcError = (error) => /internal error|fetch failed|econnreset|etimedout|network error|socket hang up|pipeline backpressure|not currently accepting transactions|request exceeds defined limit|gas rate limit exceeded|node is at capacity|failed to get contract state: getting latest accepted transaction/i.test(
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
    publicClient.getTransactionCount({ address: account.address, blockTag: "pending" }),
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
  let evmHash;
  let lastError;
  for (let attempt = 1; attempt <= 12; attempt += 1) {
    try {
      evmHash = await publicClient.sendRawTransaction({ serializedTransaction });
      break;
    } catch (error) {
      lastError = error;
      if (!isTransientRpcError(error) || attempt === 12) throw error;
      console.log(`RETRY activation ${functionName} after transient RPC backpressure (${attempt}/12)`);
      await delay(5_000);
    }
  }
  if (!evmHash) throw lastError;
  const receipt = await publicClient.waitForTransactionReceipt({ hash: evmHash });
  if (receipt.status !== "success") throw new Error(`Consensus activation reverted after using ${receipt.gasUsed} gas: ${evmHash}`);
  const events = parseEventLogs({ abi: consensus.abi, logs: receipt.logs, strict: false });
  const created = events.find((event) => event.eventName === "NewTransaction" || event.eventName === "CreatedTransaction");
  const txId = created?.args?.txId;
  if (typeof txId !== "string") throw new Error(`Consensus activation ${evmHash} did not emit a transaction ID`);
  console.log(`EVM_ACTIVATION ${functionName} ${evmHash} gasUsed=${receipt.gasUsed}`);
  return { txId, evmHash };
}

async function read(functionName, args = []) {
  let lastError;
  for (let attempt = 1; attempt <= 60; attempt += 1) {
    try {
      return await sdk.readContract({ address: contractAddress, functionName, args, transactionHashVariant: "latest-nonfinal" });
    } catch (error) {
      lastError = error;
      if (!isTransientRpcError(error) || attempt === 60) throw error;
      console.log(`RETRY view ${functionName} after transient RPC error (${attempt}/60)`);
      await delay(5_000);
    }
  }
  throw lastError;
}

const readJson = async (functionName, args = []) => {
  const value = await read(functionName, args);
  return typeof value === "string" ? JSON.parse(value) : value;
};

async function waitForAcceptedExecution(hash, retries = 2160, functionName = "unknown") {
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
    if (["UNDETERMINED", "CANCELED"].includes(status)) {
      recordCheckpoint({
        phase: "TERMINAL_FAILURE",
        functionName,
        transactionHash: hash,
        lifecycle: status,
        consensus: transaction.resultName,
        execution,
      });
      throw new Error(`Transaction ${hash} ended with status=${status} execution=${execution}`);
    }
    if (["ACCEPTED", "READY_TO_FINALIZE", "FINALIZED"].includes(status) && execution !== "NOT_VOTED") {
      if (execution !== "FINISHED_WITH_RETURN" || !["AGREE", "MAJORITY_AGREE"].includes(transaction.resultName)) {
        recordCheckpoint({
          phase: "TERMINAL_FAILURE",
          functionName,
          transactionHash: hash,
          lifecycle: status,
          consensus: transaction.resultName,
          execution,
        });
        if (execution !== "FINISHED_WITH_RETURN") throw new Error(`Transaction ${hash} execution=${execution}`);
        throw new Error(`Transaction ${hash} consensus=${transaction.resultName}`);
      }
      return transaction;
    }
    if (attempt % 12 === 0) console.log(`WAIT execution ${hash} status=${status} execution=${execution}`);
    await delay(5_000);
  }
  throw new Error(`Transaction ${hash} did not reach accepted consensus before the polling window ended`);
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
  const submission = await submitContractWrite(account, functionName, args, value);
  const hash = submission.txId;
  console.log(`TX ${functionName} ${hash}`);
  recordCheckpoint({ phase: "SUBMITTED", functionName, evmActivationHash: submission.evmHash, transactionHash: hash });
  const receipt = await waitForAcceptedExecution(hash, 360, functionName);
  if (receipt.txExecutionResultName !== "FINISHED_WITH_RETURN") {
    throw new Error(`${functionName} execution=${receipt.txExecutionResultName}`);
  }
  if (!["AGREE", "MAJORITY_AGREE"].includes(receipt.resultName)) {
    throw new Error(`${functionName} consensus=${receipt.resultName}`);
  }
  recordCheckpoint({ phase: "EXECUTED", functionName, transactionHash: hash, lifecycle: receipt.statusName, consensus: receipt.resultName, execution: receipt.txExecutionResultName });
  return { hash, receipt };
}

async function appealTransaction(hash, account) {
  if (!(await sdk.canAppeal({ txId: hash }))) throw new Error(`Transaction ${hash} cannot be appealed`);
  const value = await sdk.getMinAppealBond({ txId: hash });
  const consensus = testnetBradbury.consensusMainContract;
  if (!consensus?.address || !consensus.abi) throw new Error("Bradbury consensus contract configuration is unavailable");
  const encodedData = encodeFunctionData({ abi: consensus.abi, functionName: "submitAppeal", args: [hash] });
  const [nonce, gasPrice] = await Promise.all([
    publicClient.getTransactionCount({ address: account.address, blockTag: "pending" }),
    publicClient.getGasPrice(),
  ]);
  const estimatedGas = await publicClient.estimateGas({
    account: account.address,
    to: consensus.address,
    data: encodedData,
    value,
  });
  const serializedTransaction = await account.signTransaction({
    to: consensus.address,
    data: encodedData,
    value,
    gas: estimatedGas * 12n / 10n,
    gasPrice,
    nonce,
    chainId: testnetBradbury.id,
    type: "legacy",
  });
  const evmHash = await publicClient.sendRawTransaction({ serializedTransaction });
  const receipt = await publicClient.waitForTransactionReceipt({ hash: evmHash });
  if (receipt.status !== "success") {
    recordCheckpoint({
      phase: "ACTIVATION_FAILURE",
      functionName: "appeal_review_delivery",
      transactionHash: hash,
      evmActivationHash: evmHash,
      execution: "EVM_REVERTED",
      gasUsed: String(receipt.gasUsed),
    });
    throw new Error(`Appeal activation reverted: ${evmHash}`);
  }
  recordCheckpoint({
    phase: "APPEAL_SUBMITTED",
    functionName: "review_delivery",
    transactionHash: hash,
    evmActivationHash: evmHash,
    appealBondAtto: String(value),
  });
  console.log(`APPEAL review_delivery tx=${hash} evm=${evmHash} bondAtto=${value}`);

  let observedAppealProgress = false;
  for (let attempt = 1; attempt <= 2160; attempt += 1) {
    const transaction = await sdk.getTransaction({ hash });
    const status = transaction.statusName;
    if (["APPEAL_REVEALING", "APPEAL_COMMITTING", "PENDING", "PROPOSING", "COMMITTING", "REVEALING"].includes(status)) {
      observedAppealProgress = true;
    }
    if (["ACCEPTED", "READY_TO_FINALIZE", "FINALIZED"].includes(status) && transaction.txExecutionResultName !== "NOT_VOTED") {
      const success = transaction.txExecutionResultName === "FINISHED_WITH_RETURN"
        && ["AGREE", "MAJORITY_AGREE"].includes(transaction.resultName);
      recordCheckpoint({
        phase: success ? "APPEAL_RESOLVED" : "TERMINAL_FAILURE",
        functionName: "review_delivery",
        transactionHash: hash,
        lifecycle: status,
        consensus: transaction.resultName,
        execution: transaction.txExecutionResultName,
      });
      if (!success) throw new Error(`Appealed transaction ${hash} ended status=${status} consensus=${transaction.resultName} execution=${transaction.txExecutionResultName}`);
      return transaction;
    }
    if (["CANCELED", "UNDETERMINED"].includes(status) && observedAppealProgress) {
      recordCheckpoint({ phase: "TERMINAL_FAILURE", functionName: "review_delivery", transactionHash: hash, lifecycle: status, consensus: transaction.resultName, execution: transaction.txExecutionResultName });
      throw new Error(`Appealed transaction ${hash} ended status=${status} consensus=${transaction.resultName}`);
    }
    if (attempt % 12 === 0) console.log(`WAIT appeal ${hash} status=${status} execution=${transaction.txExecutionResultName}`);
    await delay(5_000);
  }
  throw new Error(`Appealed transaction ${hash} did not resolve before the polling window ended`);
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
      const current = await sdk.getTransaction({ hash });
      if (current.statusName === TransactionStatus.FINALIZED
        && current.txExecutionResultName === "FINISHED_WITH_RETURN"
        && ["AGREE", "MAJORITY_AGREE"].includes(current.resultName)) {
        console.log(`FINALIZE_RACE_RESOLVED ${hash} status=${current.statusName}`);
        return;
      }
      const message = error instanceof Error ? error.message : String(error);
      if (!isTransientRpcError(error) || attempt === 12) throw error;
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
  "Publish a versioned ClauseFlow release evidence dossier whose public artifacts let Bradbury validators independently verify one complete agreement lifecycle before escrow settlement.",
  "The Builder must publish a Markdown method matrix linking each contract method to the matching live dApp action and README explanation. The matrix must cover publish_offer, accept_offer with exact GEN funding, submit_delivery, review_delivery, claim_payment, confirm_payment, claim_refund, confirm_refund, get_deal_history, and get_dashboard_stats. The Builder submits the dossier, live application, direct contract source, and README through submit_delivery; Bradbury protocol-selected validators review those URLs through review_delivery.",
  "A public Markdown release dossier containing the cross-source method matrix.\nA usable public ClauseFlow dashboard configured for the reviewed release.\nThe direct public intelligent contract source.\nPublic README reviewer documentation describing the same lifecycle and settlement consequences.",
  "Each of the four submitted HTTPS sources must be fetchable.\nThe dossier must contain all ten named lifecycle methods and map each to the live interface and README.\nThe contract source must expose those named methods.\nThe README and live interface must describe publishing, exact funding, evidence delivery, validator review, Builder payment, Client refund, and public history without contradictory settlement rules.\nAPPROVED permits the Builder to claim exactly 0.02 GEN; any material mismatch requires revision, and REJECTED permits the Client refund under the funded rule.",
  price,
  2n,
  1n,
  24n,
  24n,
  refundRule,
];

const refundArgs = (title, price) => [
  title,
  "Deliver a dedicated public accessibility audit for the ClauseFlow agreement dashboard, with independently verifiable findings that determine release of the funded escrow.",
  "The Builder must publish one dedicated Markdown or HTML audit report for the public ClauseFlow dashboard. The report must separately document tested keyboard navigation, visible focus behavior, measured color contrast, and actionable remediation tied to identified interface elements. General application, repository, or README pages are supporting context and cannot replace the dedicated report.",
  "One dedicated public accessibility audit report containing four substantive sections: keyboard navigation, focus visibility, measured color contrast, and actionable remediation.",
  "The dedicated audit-report URL must be fetchable and identify ClauseFlow.\nThe report must contain concrete keyboard test results, visible-focus findings, measured contrast evidence, and actionable remediation tied to the dashboard.\nLinks to only the application, repository, or general README do not satisfy the audit deliverable.\nAPPROVED permits the Builder to claim exactly 0.015 GEN; absence of the dedicated audit report is NOT_SATISFIED and REJECTED permits the Client refund.",
  price,
  2n,
  0n,
  24n,
  24n,
  refundRule,
];

const canaryArgs = (title, price) => [
  title,
  "Verify the deployed ClauseFlow review design from its public contract source and architecture document before it is used for final submission history.",
  "The Builder must provide the direct public ClauseFlow contract source and architecture document. Validators must verify that the leader creates a detailed criterion and deliverable report, each validator treats that report as untrusted and independently refetches evidence, the contract derives outcomes deterministically, and consensus verifies material claims rather than JSON shape or identical prose.",
  "The direct public intelligent contract source at commit e91987b.\nThe public architecture document describing the same independent material-assessment flow.",
  "The contract source must contain separate detailed leader and independent report-verifier prompts.\nThe validator prompt must require independently fetched observable evidence and prohibit trusting the leader report.\nThe verifier must separately check source accessibility, criterion coverage, deliverable coverage, missing items, score, decision, and unsupported claims.\nThe architecture document must describe the same trust boundary without claiming format-only validation.",
  price,
  1n,
  0n,
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
  const clauses = draft?.clauses || {};
  const draftReady = clauses.sourceCoverage === "COMPLETE"
    && clauses.scopeSpecific === true
    && clauses.deliverablesTestable === true
    && clauses.criteriaObjective === true
    && !String(clauses.missingMaterialTerms || "").trim();
  if (!draftReady) {
    throw new Error(`Structured draft is incomplete: ${clauses.missingMaterialTerms || "material terms require clarification"}`);
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

async function completePayment(dealId, canary = false) {
  let state = await readJson("get_deal", [dealId]);
  if (state.status === "FUNDED" || state.status === "REVISION_REQUIRED") {
    const evidence = canary
      ? [dealId, "https://raw.githubusercontent.com/tanphung/ClauseFlow/e91987b/contracts/clauseflow.py", "https://raw.githubusercontent.com/tanphung/ClauseFlow/e91987b/docs/ARCHITECTURE.md", "https://raw.githubusercontent.com/tanphung/ClauseFlow/e91987b/README.md", "https://github.com/tanphung/ClauseFlow/tree/e91987b", "Canary delivery: the version-pinned contract source and architecture document expose the independent material validator design. The README and immutable GitHub tree corroborate the reviewed commit; settlement is permitted only if validators substantively confirm every accepted design obligation."]
      : [dealId, "https://clauseflow-two.vercel.app", "https://raw.githubusercontent.com/tanphung/ClauseFlow/main/contracts/clauseflow.py", "https://raw.githubusercontent.com/tanphung/ClauseFlow/main/docs/RELEASE_EVIDENCE.md", "https://raw.githubusercontent.com/tanphung/ClauseFlow/main/README.md", "ClauseFlow evidence dossier delivery: the public dossier maps the submitted live dashboard, direct intelligent contract source, and this README. The README is the standalone reviewer documentation for independent validator verification."];
    await write(builder, "submit_delivery", evidence);
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
  recordCheckpoint({ phase: "DEAL_STATE", dealId, expectedStatus: "PAID", actualStatus: state.status, amountAtto: state.lockedAttoGen });
  return state;
}

async function completeRefund(dealId) {
  let state = await readJson("get_deal", [dealId]);
  if (state.status === "FUNDED" || state.status === "REVISION_REQUIRED") {
    await write(builder, "submit_delivery", [dealId, "https://raw.githubusercontent.com/tanphung/ClauseFlow/main/docs/ACCESSIBILITY_AUDIT_STATUS.md", "https://raw.githubusercontent.com/tanphung/ClauseFlow/main/contracts/clauseflow.py", "https://clauseflow-two.vercel.app", "https://raw.githubusercontent.com/tanphung/ClauseFlow/main/README.md", "The public delivery-status artifact truthfully records that the contracted dedicated accessibility audit was not delivered. The live app, source, and README are supporting context only and do not contain the required keyboard, focus, measured contrast, and remediation audit."]);
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
  recordCheckpoint({ phase: "DEAL_STATE", dealId, expectedStatus: "REFUNDED", actualStatus: state.status, amountAtto: state.lockedAttoGen });
  return state;
}

console.log(`SMOKE mode=${mode} builder=${builder.address} client=${client.address} contract=${contractAddress}`);

if (mode === "finalize") {
  await finalizeParentTransaction(resumedPaymentDealId, builder);
  console.log(`SMOKE_FINALIZE_OK tx=${resumedPaymentDealId}`);
  process.exit(0);
}

if (mode === "appeal") {
  const result = await appealTransaction(resumedPaymentDealId, builder);
  console.log(`SMOKE_APPEAL_OK tx=${resumedPaymentDealId} status=${result.statusName} consensus=${result.resultName} execution=${result.txExecutionResultName}`);
  process.exit(0);
}

if (mode === "finalize-idle") {
  const before = await sdk.getTransaction({ hash: resumedPaymentDealId });
  if (!["UNDETERMINED", "VALIDATORS_TIMEOUT", "LEADER_TIMEOUT"].includes(before.statusName)) {
    throw new Error(`Idleness finalization requires a stuck transaction, received ${before.statusName}`);
  }
  let evmHash;
  for (let attempt = 1; attempt <= 12; attempt += 1) {
    try {
      evmHash = await sdk.finalizeIdlenessTxs({ account: builder, txIds: [resumedPaymentDealId] });
      break;
    } catch (error) {
      if (!isTransientRpcError(error) || attempt === 12) throw error;
      console.log(`RETRY finalize-idle ${resumedPaymentDealId} after transient RPC backpressure (${attempt}/12)`);
      await delay(5_000);
    }
  }
  if (!evmHash) throw new Error(`Idleness finalization was not submitted for ${resumedPaymentDealId}`);
  recordCheckpoint({
    phase: "IDLENESS_FINALIZED",
    functionName: "review_delivery",
    transactionHash: resumedPaymentDealId,
    evmActivationHash: evmHash,
    lifecycleBefore: before.statusName,
  });
  console.log(`SMOKE_FINALIZE_IDLE_OK tx=${resumedPaymentDealId} evm=${evmHash} previous=${before.statusName}`);
  process.exit(0);
}

const baselineStats = await readJson("get_dashboard_stats");
const baselineCompleted = BigInt(baselineStats.completedDeals);
const baselinePaid = BigInt(baselineStats.totalPaidAtto);
const baselineRefunded = BigInt(baselineStats.totalRefundedAtto);

if (mode === "canary") {
  const canaryPrice = 1_000_000_000_000_000n;
  const canaryTitle = "ClauseFlow validator consensus canary e91987b";
  const canaryOffer = await createOffer(canaryTitle, canaryArgs(canaryTitle, canaryPrice));
  const canaryDeal = await fundOffer(canaryOffer, canaryPrice);
  await completePayment(canaryDeal, true);
  const stats = await readJson("get_dashboard_stats");
  if (BigInt(stats.completedDeals) !== baselineCompleted + 1n || BigInt(stats.totalPaidAtto) !== baselinePaid + canaryPrice || BigInt(stats.totalRefundedAtto) !== baselineRefunded) {
    throw new Error(`Unexpected canary stats ${JSON.stringify(stats)}`);
  }
  recordCheckpoint({ phase: "MODE_COMPLETE", mode, canaryDeal, stats });
  console.log(`SMOKE_OK mode=${mode} canaryDeal=${canaryDeal} stats=${JSON.stringify(stats)}`);
  process.exit(0);
}

const paymentPrice = 20_000_000_000_000_000n;
const paymentTitle = process.env.CLAUSEFLOW_SMOKE_PAYMENT_TITLE || "ClauseFlow release evidence dossier";
let paymentDeal = "";
if (["full", "payment-only"].includes(mode)) {
  const paymentOffer = await createOffer(paymentTitle, paymentArgs(paymentTitle, paymentPrice));
  paymentDeal = await fundOffer(paymentOffer, paymentPrice);
  await completePayment(paymentDeal);
}

if (mode === "payment-only") {
  const stats = await readJson("get_dashboard_stats");
  if (BigInt(stats.completedDeals) !== baselineCompleted + 1n || BigInt(stats.totalPaidAtto) !== baselinePaid + paymentPrice || BigInt(stats.totalRefundedAtto) !== baselineRefunded) {
    throw new Error(`Unexpected payment-only stats ${JSON.stringify(stats)}`);
  }
  recordCheckpoint({ phase: "MODE_COMPLETE", mode, paymentDeal, stats });
  console.log(`SMOKE_OK mode=${mode} paymentDeal=${paymentDeal} stats=${JSON.stringify(stats)}`);
  process.exit(0);
}

if (mode === "payment-revision") {
  const existing = await readJson("get_deal", [resumedPaymentDealId]);
  if (existing.status !== "REVISION_REQUIRED") {
    throw new Error(`Payment revision requires REVISION_REQUIRED, received ${existing.status}`);
  }
  const completed = await completePayment(resumedPaymentDealId);
  console.log(`SMOKE_PAYMENT_REVISION_OK deal=${resumedPaymentDealId} status=${completed.status}`);
  process.exit(0);
}

if (mode === "payment-resume") {
  const existing = await readJson("get_deal", [resumedPaymentDealId]);
  if (!["FUNDED", "REVISION_REQUIRED", "SUBMITTED", "APPROVED", "PAYMENT_PENDING"].includes(existing.status)) {
    throw new Error(`Payment resume requires an active payment state, received ${existing.status}`);
  }
  const completed = await completePayment(resumedPaymentDealId);
  console.log(`SMOKE_PAYMENT_RESUME_OK deal=${resumedPaymentDealId} status=${completed.status}`);
  process.exit(0);
}

if (mode === "refund-resume") {
  const existing = await readJson("get_deal", [resumedPaymentDealId]);
  if (!["FUNDED", "REVISION_REQUIRED", "SUBMITTED", "REJECTED", "REFUND_PENDING"].includes(existing.status)) {
    throw new Error(`Refund resume requires an active refund state, received ${existing.status}`);
  }
  const completed = await completeRefund(resumedPaymentDealId);
  console.log(`SMOKE_REFUND_RESUME_OK deal=${resumedPaymentDealId} status=${completed.status}`);
  process.exit(0);
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
recordCheckpoint({ phase: "MODE_COMPLETE", mode, paymentDeal: paymentDeal || "", refundDeal, stats });
}
