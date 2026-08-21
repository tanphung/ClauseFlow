import { closeSync, mkdirSync, openSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { abi, createClient } from "genlayer-js";
import { testnetBradbury } from "genlayer-js/chains";
import { createPublicClient, encodeFunctionData, formatEther, http, parseEventLogs } from "viem";
import { privateKeyToAccount } from "viem/accounts";

const contractAddress = process.argv[2];
const mode = process.argv[3] || "full";
if (!/^0x[a-fA-F0-9]{40}$/.test(contractAddress || "")) throw new Error("Usage: npm run smoke:bradbury -- <contract-address> [preflight|payment-only|refund-only|full|resume]");
if (!["preflight", "payment-only", "refund-only", "full", "resume"].includes(mode)) throw new Error(`Unknown smoke mode: ${mode}`);

const env = readEnv();
const builder = privateKeyToAccount(requiredKey(env.CLAUSEFLOW_BUILDER_PRIVATE_KEY || env.ClauseFlow2_PRIVATE_KEY, "Builder"));
const client = privateKeyToAccount(requiredKey(env.CLAUSEFLOW_CLIENT_PRIVATE_KEY || env.ClauseFlow3_PRIVATE_KEY, "Client"));
if (builder.address.toLowerCase() === client.address.toLowerCase()) throw new Error("Builder and Client must be different wallets");
verifyExpectedAddress(builder.address, env.EXPECTED_BUILDER_WALLET_ADDRESS || env.ClauseFlow2_ADDRESS, "Builder");
verifyExpectedAddress(client.address, env.EXPECTED_CLIENT_WALLET_ADDRESS || env.ClauseFlow3_ADDRESS, "Client");

const sdk = createClient({ chain: testnetBradbury });
const publicClient = createPublicClient({ chain: testnetBradbury, transport: http(undefined, { timeout: 30_000, retryCount: 0 }) });
const consensus = testnetBradbury.consensusMainContract;
if (!consensus?.address || !consensus.abi) throw new Error("Bradbury consensus contract configuration is unavailable");
const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
const transient = (error) => /internal error|fetch failed|timeout|timed out|econnreset|etimedout|network error|socket hang up|pipeline backpressure|not currently accepting transactions|request exceeds defined limit|gas rate limit exceeded|node is at capacity|failed to get contract state/i.test(error instanceof Error ? error.message : String(error));
const runtimeDirectory = ".codex-runtime";
const lockPath = `${runtimeDirectory}/bradbury-smoke.lock`;
const checkpointPath = `${runtimeDirectory}/bradbury-smoke-${contractAddress.toLowerCase()}.json`;
mkdirSync(runtimeDirectory, { recursive: true });
acquireLock();
process.on("exit", () => rmSync(lockPath, { force: true }));

const [builderBalance, clientBalance] = await Promise.all([
  publicClient.getBalance({ address: builder.address }),
  publicClient.getBalance({ address: client.address })
]);
console.log(`SMOKE_CONTRACT=${contractAddress}`);
console.log(`SMOKE_BUILDER=${builder.address} balance=${formatEther(builderBalance)} GEN`);
console.log(`SMOKE_CLIENT=${client.address} balance=${formatEther(clientBalance)} GEN`);
if (clientBalance < 100_000_000_000_000_000n) throw new Error("Client balance is below 0.1 GEN");
if (builderBalance < 50_000_000_000_000_000n) throw new Error("Builder balance is below 0.05 GEN");

const policy = await readJson("get_protocol_policy");
if (policy.protocolVersion !== "CLAUSEFLOW_V2") throw new Error(`Expected CLAUSEFLOW_V2, received ${policy.protocolVersion}`);
const routerAddress = policy.settlementRouter;
if (!/^0x[a-fA-F0-9]{40}$/.test(routerAddress)) throw new Error("Contract returned an invalid settlement router");
const routerAbi = [
  { type: "function", name: "clauseFlow", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { type: "function", name: "release_settlement", stateMutability: "nonpayable", inputs: [{ name: "settlementId", type: "string" }], outputs: [] },
  { type: "function", name: "get_settlement", stateMutability: "view", inputs: [{ name: "settlementId", type: "string" }], outputs: [{ name: "source", type: "address" }, { name: "dealHash", type: "bytes32" }, { name: "recipient", type: "address" }, { name: "amount", type: "uint256" }, { name: "kind", type: "uint8" }, { name: "state", type: "uint8" }] }
];
const boundClauseFlow = await publicClient.readContract({ address: routerAddress, abi: routerAbi, functionName: "clauseFlow" });
if (boundClauseFlow.toLowerCase() !== contractAddress.toLowerCase()) throw new Error("Settlement router is not bound to this ClauseFlow contract");
console.log(`SMOKE_ROUTER=${routerAddress}`);
console.log("SMOKE_PREFLIGHT_OK=true");
if (mode === "preflight") process.exit(0);

const commit = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
if (!/^[0-9a-f]{40}$/.test(commit)) throw new Error("Could not determine the immutable Git commit");
const baseRaw = `https://raw.githubusercontent.com/tanphung/ClauseFlow/${commit}`;
const evidenceUrls = {
  contract: `${baseRaw}/contracts/clauseflow.py`,
  router: `${baseRaw}/contracts/SettlementRouter.sol`,
  readme: `${baseRaw}/README.md`,
  release: `${baseRaw}/docs/RELEASE_EVIDENCE.md`,
  app: `${baseRaw}/src/App.tsx`,
  auditStatus: `${baseRaw}/docs/ACCESSIBILITY_AUDIT_STATUS.md`
};
for (const [label, url] of Object.entries(evidenceUrls)) await assertPublic(label, url);

if (["full", "payment-only", "resume"].includes(mode)) await runPayment();
if (["full", "refund-only", "resume"].includes(mode)) await runRefund();

const finalStats = await readJson("get_dashboard_stats");
console.log(`FINAL_STATS=${JSON.stringify(finalStats)}`);
if (mode === "full" || mode === "resume") {
  if (finalStats.totalDeals !== "2" || finalStats.completedDeals !== "2" || finalStats.totalPaidAtto !== "20000000000000000" || finalStats.totalRefundedAtto !== "15000000000000000" || finalStats.accountedEscrowAtto !== "0") {
    throw new Error(`Unexpected final dashboard state: ${JSON.stringify(finalStats)}`);
  }
}
record({ phase: "SMOKE_COMPLETE", mode, stats: finalStats });
console.log("SMOKE_VERIFIED=true");

async function runPayment() {
  const title = "ClauseFlow v2 immutable enforcement dossier";
  const terms = [
    title,
    "A version-bound release dossier proving that every accepted obligation, revision/refund deadline, and deal-specific settlement receipt is enforced by ClauseFlow v2.",
    JSON.stringify([
      { id: "O_METHODS", category: "DELIVERABLE", statement: "Publish a versioned method dossier covering all twenty-one ClauseFlow v2 public methods and the SettlementRouter release path.", acceptanceRule: "The pinned dossier names all twenty-one public methods and maps settlement initiation, recipient release, and receipt confirmation to public source.", requiredEvidenceTypes: ["DOCUMENTATION", "SOURCE"] },
      { id: "O_TERMS", category: "ACCEPTANCE", statement: "Demonstrate that accepted obligations and stored delivery, revision, review-timeout, and refund terms are enforced without unstated settlement shortcuts.", acceptanceRule: "Pinned contract source and documentation visibly enforce the exact obligation manifest and every funded timing or revision condition.", requiredEvidenceTypes: ["SOURCE", "DOCUMENTATION"] },
      { id: "O_RECEIPT", category: "ACCEPTANCE", statement: "Bind payment confirmation to the specific deal, Builder recipient, exact amount, settlement kind, router source, and released receipt state.", acceptanceRule: "Pinned ClauseFlow and router source cross-check deal ID, recipient, amount, kind, source contract, and released state before PAID is recorded.", requiredEvidenceTypes: ["SOURCE"] },
      { id: "O_INTERFACE", category: "DELIVERABLE", statement: "Expose the v2 obligations, immutable evidence versions, validator reasoning, deadlines, and exact settlement receipt in the public interface source.", acceptanceRule: "The pinned interface source renders each stored v2 field and never invents validator analysis or settlement success.", requiredEvidenceTypes: ["DELIVERY"] }
    ]),
    20_000_000_000_000_000n, 48n, 24n, 1n, 24n, 24n
  ];
  const manifest = await buildManifest([
    ["E_DOSSIER", "DOCUMENTATION", "Release evidence dossier", evidenceUrls.release],
    ["E_CONTRACT", "SOURCE", "ClauseFlow v2 contract", evidenceUrls.contract],
    ["E_ROUTER", "SOURCE", "Deal-specific settlement router", evidenceUrls.router],
    ["E_INTERFACE", "DELIVERY", "ClauseFlow v2 interface source", evidenceUrls.app],
    ["E_README", "DOCUMENTATION", "Reviewer documentation", evidenceUrls.readme]
  ]);
  const offer = await ensureOffer(title, terms);
  let deal = await ensureDeal(title, offer.id, client, 20_000_000_000_000_000n);
  if (["FUNDED", "REVISION_REQUIRED"].includes(deal.status)) {
    await writeAndRequireState(builder, "submit_delivery", [deal.id, JSON.stringify(manifest), "Pinned commit evidence links every accepted obligation to immutable contract, router, interface, and reviewer documentation."], 0n, deal.id, "SUBMITTED");
    deal = await readJson("get_deal", [deal.id]);
  }
  if (deal.status === "SUBMITTED") {
    await writeAndRequireState(client, "review_delivery", [deal.id], 0n, deal.id, ["APPROVED", "REVISION_REQUIRED", "REJECTED"]);
    deal = await readJson("get_deal", [deal.id]);
  }
  if (deal.status !== "APPROVED" && deal.status !== "PAYMENT_PENDING" && deal.status !== "PAID") {
    throw new Error(`Payment agreement did not reach APPROVED; status=${deal.status} result=${deal.reviewResult}`);
  }
  assertDetailedReview(deal, 4, "APPROVED");
  if (deal.status === "APPROVED") {
    await writeAndRequireState(builder, "claim_payment", [deal.id], 0n, deal.id, "PAYMENT_PENDING");
    deal = await readJson("get_deal", [deal.id]);
  }
  if (deal.status === "PAYMENT_PENDING") {
    await releaseExactSettlement(deal, builder, 1, 20_000_000_000_000_000n);
    await writeAndRequireState(builder, "confirm_payment", [deal.id], 0n, deal.id, "PAID");
    deal = await readJson("get_deal", [deal.id]);
  }
  if (deal.status !== "PAID" || deal.paid !== "true") throw new Error(`Payment agreement is not terminal: ${JSON.stringify(deal)}`);
  record({ phase: "PAYMENT_VERIFIED", dealId: deal.id, status: deal.status, settlementId: deal.settlementId, reviewScore: deal.reviewScore });
  console.log(`PAYMENT_DEAL=${deal.id} status=${deal.status} score=${deal.reviewScore}`);
}

async function runRefund() {
  const title = "ClauseFlow v2 accessibility audit non-delivery";
  const terms = [
    title,
    "A consumer-protection pilot requiring a dedicated measured accessibility audit. The status artifact truthfully records that no qualifying audit was delivered.",
    JSON.stringify([
      { id: "O_AUDIT", category: "DELIVERABLE", statement: "Publish one immutable accessibility audit with tested keyboard navigation, visible focus, measured color contrast ratios, and actionable remediation findings.", acceptanceRule: "A versioned AUDIT source contains concrete keyboard, focus, measured contrast, and remediation results for the ClauseFlow interface.", requiredEvidenceTypes: ["AUDIT"] },
      { id: "O_MEASUREMENTS", category: "EVIDENCE", statement: "Provide reproducible measurements and affected interface locations for every reported accessibility issue.", acceptanceRule: "The submitted AUDIT evidence names tested elements, measurement method, observed values, expected thresholds, and affected locations.", requiredEvidenceTypes: ["AUDIT"] }
    ]),
    15_000_000_000_000_000n, 48n, 24n, 0n, 0n, 24n
  ];
  const manifest = await buildManifest([
    ["E_STATUS", "DOCUMENTATION", "Truthful audit delivery status", evidenceUrls.auditStatus],
    ["E_README", "DOCUMENTATION", "Project context only", evidenceUrls.readme]
  ]);
  const offer = await ensureOffer(title, terms);
  let deal = await ensureDeal(title, offer.id, client, 15_000_000_000_000_000n);
  if (deal.status === "FUNDED") {
    await writeAndRequireState(builder, "submit_delivery", [deal.id, JSON.stringify(manifest), "No dedicated measured accessibility audit was delivered. These immutable documentation links disclose that absence and are not substitutes for the required AUDIT evidence."], 0n, deal.id, "SUBMITTED");
    deal = await readJson("get_deal", [deal.id]);
  }
  if (deal.status === "SUBMITTED") {
    await writeAndRequireState(client, "review_delivery", [deal.id], 0n, deal.id, "REJECTED");
    deal = await readJson("get_deal", [deal.id]);
  }
  if (!["REJECTED", "REFUND_PENDING", "REFUNDED"].includes(deal.status)) throw new Error(`Refund agreement did not reach REJECTED; status=${deal.status}`);
  assertDetailedReview(deal, 2, "REJECTED");
  if (deal.status === "REJECTED") {
    await writeAndRequireState(client, "claim_refund", [deal.id], 0n, deal.id, "REFUND_PENDING");
    deal = await readJson("get_deal", [deal.id]);
  }
  if (deal.status === "REFUND_PENDING") {
    await releaseExactSettlement(deal, client, 2, 15_000_000_000_000_000n);
    await writeAndRequireState(client, "confirm_refund", [deal.id], 0n, deal.id, "REFUNDED");
    deal = await readJson("get_deal", [deal.id]);
  }
  if (deal.status !== "REFUNDED" || deal.refunded !== "true") throw new Error(`Refund agreement is not terminal: ${JSON.stringify(deal)}`);
  record({ phase: "REFUND_VERIFIED", dealId: deal.id, status: deal.status, settlementId: deal.settlementId, reviewScore: deal.reviewScore });
  console.log(`REFUND_DEAL=${deal.id} status=${deal.status} score=${deal.reviewScore}`);
}

async function ensureOffer(title, terms) {
  const ids = await readJson("get_offer_ids");
  for (const id of ids) {
    const offer = await readJson("get_offer", [id]);
    if (offer.title === title) return offer;
  }
  await writeAndVerify(builder, "structure_offer", terms, 0n);
  await writeAndVerify(builder, "publish_offer", terms, 0n);
  const nextIds = await waitFor(async () => {
    const values = await readJson("get_offer_ids");
    return values.length > ids.length ? values : null;
  }, `offer ${title}`);
  const created = await readJson("get_offer", [nextIds[nextIds.length - 1]]);
  if (created.title !== title) throw new Error(`Published offer title mismatch: ${created.title}`);
  return created;
}

async function ensureDeal(title, offerId, account, amount) {
  const ids = await readJson("get_deal_ids");
  for (const id of ids) {
    const current = await readJson("get_deal", [id]);
    if (current.title === title) return current;
  }
  await writeAndVerify(account, "accept_offer", [offerId], amount);
  return await waitFor(async () => {
    const nextIds = await readJson("get_deal_ids");
    for (const id of nextIds) {
      const current = await readJson("get_deal", [id]);
      if (current.title === title) return current;
    }
    return null;
  }, `funded deal ${title}`);
}

async function writeAndRequireState(account, functionName, args, value, dealId, expected) {
  const proof = await writeAndVerify(account, functionName, args, value);
  const allowed = Array.isArray(expected) ? expected : [expected];
  const current = await waitFor(async () => {
    const next = await readJson("get_deal", [dealId]);
    return allowed.includes(next.status) ? next : null;
  }, `${functionName} state ${allowed.join("|")}`);
  record({ ...proof, phase: "STATE_VERIFIED", functionName, dealId, resultingState: current.status });
  return current;
}

async function writeAndVerify(account, functionName, args, value) {
  const { transactionHash, activationHash } = await submitContractWrite(account, functionName, args, value);
  console.log(`TX ${functionName} activation=${activationHash} genlayer=${transactionHash}`);
  let transaction = await waitForExecution(transactionHash, functionName);
  transaction = await waitForFinality(transactionHash, transaction);
  const proof = { functionName, activationHash, transactionHash, lifecycle: transaction.statusName, consensus: transaction.resultName, execution: transaction.txExecutionResultName };
  record({ phase: "TRANSACTION_VERIFIED", ...proof });
  return proof;
}

async function submitContractWrite(account, functionName, args, value) {
  const appCalldata = abi.calldata.encode(abi.calldata.makeCalldataObject(functionName, args));
  const serializedData = abi.transactions.serialize([appCalldata, false]);
  const data = encodeFunctionData({
    abi: consensus.abi,
    functionName: "addTransaction",
    args: [account.address, contractAddress, BigInt(testnetBradbury.defaultNumberOfInitialValidators), 5n, serializedData, BigInt(Math.floor(Date.now() / 1000) + 3600)]
  });
  const result = await sendRaw(account, { to: consensus.address, data, value, gasLimit: 7_000_000n });
  const events = parseEventLogs({ abi: consensus.abi, logs: result.receipt.logs, strict: false });
  const created = events.find((event) => event.eventName === "NewTransaction" || event.eventName === "CreatedTransaction");
  const transactionHash = created?.args?.txId;
  if (typeof transactionHash !== "string") throw new Error(`Activation did not emit a GenLayer transaction ID: ${result.hash}`);
  return { transactionHash, activationHash: result.hash };
}

async function releaseExactSettlement(deal, account, expectedKind, expectedAmount) {
  if (!deal.settlementId) throw new Error("Pending deal has no settlement ID");
  const funded = await waitFor(async () => {
    const receipt = await readRouterReceipt(deal.settlementId);
    return receipt.state === 1 ? receipt : null;
  }, `router funding ${deal.settlementId}`, 360);
  if (funded.source.toLowerCase() !== contractAddress.toLowerCase() || funded.recipient.toLowerCase() !== account.address.toLowerCase() || funded.amount !== expectedAmount || funded.kind !== expectedKind) {
    throw new Error(`Router receipt does not match the deal: ${JSON.stringify({ ...funded, amount: funded.amount.toString() })}`);
  }
  const data = encodeFunctionData({ abi: routerAbi, functionName: "release_settlement", args: [deal.settlementId] });
  const release = await sendRaw(account, { to: routerAddress, data, value: 0n, gasLimit: 500_000n });
  const released = await readRouterReceipt(deal.settlementId);
  if (released.state !== 2) throw new Error(`Router receipt did not reach RELEASED: ${deal.settlementId}`);
  record({ phase: "ROUTER_RELEASE_VERIFIED", dealId: deal.id, settlementId: deal.settlementId, evmHash: release.hash, recipient: released.recipient, amount: released.amount.toString(), kind: released.kind, source: released.source, state: released.state });
  console.log(`ROUTER_RELEASE ${deal.settlementId} ${release.hash}`);
}

async function sendRaw(account, { to, data, value, gasLimit }) {
  const [nonce, gasPrice] = await Promise.all([
    retry(() => publicClient.getTransactionCount({ address: account.address, blockTag: "pending" })),
    retry(() => publicClient.getGasPrice())
  ]);
  const signed = await account.signTransaction({ to, data, value, gas: gasLimit, gasPrice, nonce, chainId: testnetBradbury.id, type: "legacy" });
  const hash = await retry(() => publicClient.sendRawTransaction({ serializedTransaction: signed }));
  const receipt = await publicClient.waitForTransactionReceipt({ hash, confirmations: 1 });
  if (receipt.status !== "success") throw new Error(`EVM transaction reverted: ${hash}`);
  return { hash, receipt };
}

async function waitForExecution(hash, functionName) {
  for (let attempt = 1; attempt <= 2160; attempt += 1) {
    const current = await retry(() => sdk.getTransaction({ hash }));
    if (["UNDETERMINED", "CANCELED"].includes(current.statusName)) throw new Error(`${functionName} ended ${current.statusName}/${current.resultName}/${current.txExecutionResultName}`);
    if (["ACCEPTED", "READY_TO_FINALIZE", "FINALIZED"].includes(current.statusName) && current.txExecutionResultName !== "NOT_VOTED") {
      if (current.txExecutionResultName !== "FINISHED_WITH_RETURN") throw new Error(`${functionName} execution=${current.txExecutionResultName}`);
      if (!["AGREE", "MAJORITY_AGREE"].includes(current.resultName)) throw new Error(`${functionName} consensus=${current.resultName}`);
      return current;
    }
    if (attempt % 12 === 0) console.log(`WAIT ${functionName} ${hash} ${current.statusName}/${current.txExecutionResultName}`);
    await delay(5_000);
  }
  throw new Error(`${functionName} did not reach successful execution: ${hash}`);
}

async function waitForFinality(hash, current) {
  for (let attempt = 1; attempt <= 2160 && current.statusName !== "FINALIZED"; attempt += 1) {
    await delay(5_000);
    current = await retry(() => sdk.getTransaction({ hash }));
    if (["UNDETERMINED", "CANCELED"].includes(current.statusName)) throw new Error(`Transaction failed before finality: ${hash}`);
    if (attempt % 12 === 0) console.log(`WAIT_FINALITY ${hash} ${current.statusName}`);
  }
  if (current.statusName !== "FINALIZED" || current.txExecutionResultName !== "FINISHED_WITH_RETURN" || !["AGREE", "MAJORITY_AGREE"].includes(current.resultName)) {
    throw new Error(`Transaction lacks final success proof: ${hash}`);
  }
  return current;
}

async function readJson(functionName, args = []) {
  const value = await retry(() => sdk.readContract({ address: contractAddress, functionName, args, transactionHashVariant: "latest-nonfinal" }), 24);
  return typeof value === "string" ? JSON.parse(value) : value;
}

async function readRouterReceipt(settlementId) {
  const result = await retry(() => publicClient.readContract({ address: routerAddress, abi: routerAbi, functionName: "get_settlement", args: [settlementId] }), 24);
  return { source: result[0], dealHash: result[1], recipient: result[2], amount: result[3], kind: Number(result[4]), state: Number(result[5]) };
}

async function buildManifest(rows) {
  const result = [];
  for (const [id, type, label, url] of rows) {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) throw new Error(`Evidence fetch failed ${response.status}: ${url}`);
    const bytes = new Uint8Array(await response.arrayBuffer());
    result.push({ id, type, label, url, versionKind: "GIT_COMMIT", versionId: commit, sha256: createHash("sha256").update(bytes).digest("hex") });
  }
  return result;
}

function assertDetailedReview(current, obligationCount, result) {
  const assessments = JSON.parse(current.reviewObligationAssessments || "[]");
  const sources = JSON.parse(current.reviewSourceAssessments || "[]");
  if (current.reviewResult !== result || assessments.length !== obligationCount || sources.length < 1) throw new Error(`Incomplete ${result} review report`);
  const expected = JSON.parse(current.obligations).map((item) => item.id).sort();
  const received = assessments.map((item) => item.obligationId).sort();
  if (JSON.stringify(expected) !== JSON.stringify(received)) throw new Error("Validator report did not adjudicate every accepted obligation ID");
  for (const assessment of assessments) {
    if (!assessment.finding || !assessment.reasoning || assessment.finding.length < 12 || assessment.reasoning.length < 20) throw new Error(`Shallow assessment for ${assessment.obligationId}`);
  }
  if (!current.reviewConsensusBasis || current.reviewConsensusBasis.length < 40) throw new Error("Validator consensus basis is missing");
}

async function assertPublic(label, url) {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error(`${label} is not public (${response.status}): ${url}`);
  const text = await response.text();
  if (text.trim().length < 20) throw new Error(`${label} returned an empty public artifact`);
  console.log(`PUBLIC_EVIDENCE_OK ${label} bytes=${Buffer.byteLength(text)}`);
}

async function waitFor(operation, label, attempts = 180) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const value = await operation();
      if (value) return value;
    } catch (error) { lastError = error; }
    if (attempt % 12 === 0) console.log(`WAIT_STATE ${label} (${attempt}/${attempts})`);
    await delay(5_000);
  }
  throw new Error(`Timed out waiting for ${label}${lastError ? `: ${String(lastError)}` : ""}`);
}

function acquireLock() {
  try {
    const handle = openSync(lockPath, "wx");
    writeFileSync(handle, JSON.stringify({ pid: process.pid, contractAddress, mode, startedAt: new Date().toISOString() }));
    closeSync(handle);
  } catch (error) {
    let active = false;
    try {
      const pid = Number(JSON.parse(readFileSync(lockPath, "utf8")).pid || 0);
      if (pid) { process.kill(pid, 0); active = true; }
    } catch { rmSync(lockPath, { force: true }); }
    if (active) throw new Error("Another Bradbury smoke process is active", { cause: error });
    const handle = openSync(lockPath, "wx");
    writeFileSync(handle, JSON.stringify({ pid: process.pid, contractAddress, mode, startedAt: new Date().toISOString() }));
    closeSync(handle);
  }
}

function record(entry) {
  let checkpoint = { version: 2, network: "testnetBradbury", contractAddress, routerAddress, updatedAt: new Date().toISOString(), records: [] };
  try { checkpoint = JSON.parse(readFileSync(checkpointPath, "utf8")); } catch { /* Start a new journal. */ }
  checkpoint.updatedAt = new Date().toISOString();
  checkpoint.records = [...(checkpoint.records || []), { ...entry, recordedAt: new Date().toISOString() }];
  writeFileSync(checkpointPath, JSON.stringify(checkpoint, null, 2));
}

function readEnv() {
  return Object.fromEntries(readFileSync(".env", "utf8").split(/\r?\n/).filter((line) => /^\s*[A-Za-z_][A-Za-z0-9_]*\s*=/.test(line)).map((line) => {
    const index = line.indexOf("=");
    return [line.slice(0, index).trim(), line.slice(index + 1).trim().replace(/^["']|["']$/g, "")];
  }));
}

function requiredKey(value, label) {
  if (!/^0x[a-fA-F0-9]{64}$/.test(value || "")) throw new Error(`Missing valid ${label} private key`);
  return value;
}

function verifyExpectedAddress(actual, expected, label) {
  if (expected && actual.toLowerCase() !== expected.toLowerCase()) throw new Error(`${label} private key/address mismatch`);
}

async function retry(operation, attempts = 12) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try { return await operation(); } catch (error) {
      lastError = error;
      if (!transient(error) || attempt === attempts) throw error;
      await delay(5_000);
    }
  }
  throw lastError;
}
