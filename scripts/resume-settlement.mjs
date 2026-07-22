import { readFileSync } from "node:fs";
import { abi, createClient } from "genlayer-js";
import { testnetBradbury } from "genlayer-js/chains";
import { TransactionStatus } from "genlayer-js/types";
import { privateKeyToAccount } from "viem/accounts";
import { createPublicClient, encodeFunctionData, http, parseEventLogs } from "viem";

const [contractAddress, dealId, settlement, claimHash] = process.argv.slice(2);
if (!/^0x[a-fA-F0-9]{40}$/.test(contractAddress || "") || !/^\d+$/.test(dealId || "")) {
  throw new Error("Usage: node scripts/resume-settlement.mjs <contract> <deal-id> <payment|refund> <claim-tx-hash>");
}
if (!["payment", "refund"].includes(settlement) || !/^0x[a-fA-F0-9]{64}$/.test(claimHash || "")) {
  throw new Error("Settlement must be payment or refund and claim-tx-hash must be a valid transaction hash");
}

const env = Object.fromEntries(
  readFileSync(".env", "utf8")
    .split(/\r?\n/)
    .filter((line) => /^\s*[A-Za-z_][A-Za-z0-9_]*\s*=/.test(line))
    .map((line) => {
      const index = line.indexOf("=");
      return [line.slice(0, index).trim(), line.slice(index + 1).trim().replace(/^['\"]|['\"]$/g, "")];
    }),
);
const key = settlement === "payment"
  ? env.CLAUSEFLOW_BUILDER_PRIVATE_KEY || env.ClauseFlow2_PRIVATE_KEY
  : env.CLAUSEFLOW_CLIENT_PRIVATE_KEY || env.ClauseFlow3_PRIVATE_KEY;
if (!/^0x[a-fA-F0-9]{64}$/.test(key || "")) throw new Error(`Missing valid ${settlement} settlement private key`);

const account = privateKeyToAccount(key);
const sdk = createClient({ chain: testnetBradbury });
const publicClient = createPublicClient({ chain: testnetBradbury, transport: http() });
const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function retry(label, operation, attempts = 12) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      const message = error instanceof Error ? error.message : String(error);
      if (!message.includes("Internal error") || attempt === attempts) throw error;
      console.log(`RETRY ${label} (${attempt}/${attempts})`);
      await delay(5_000);
    }
  }
  throw lastError;
}

async function readJson(functionName, args = []) {
  const value = await retry(`view ${functionName}`, () => sdk.readContract({ address: contractAddress, functionName, args }));
  return typeof value === "string" ? JSON.parse(value) : value;
}

async function waitForClaimFinalization() {
  for (let attempt = 1; attempt <= 1_440; attempt += 1) {
    const transaction = await retry("claim status", () => sdk.getTransaction({ hash: claimHash }));
    const { statusName, resultName, txExecutionResultName } = transaction;
    if (["UNDETERMINED", "CANCELED", "VALIDATORS_TIMEOUT", "LEADER_TIMEOUT"].includes(statusName)) {
      throw new Error(`Claim failed status=${statusName} result=${resultName} execution=${txExecutionResultName}`);
    }
    if (txExecutionResultName !== "NOT_VOTED" && txExecutionResultName !== "FINISHED_WITH_RETURN") {
      throw new Error(`Claim execution failed: ${txExecutionResultName}`);
    }
    if (statusName === TransactionStatus.FINALIZED) return transaction;
    if (statusName === TransactionStatus.READY_TO_FINALIZE) {
      const evmHash = await retry("finalize", () => sdk.finalizeTransaction({ account, txId: claimHash }));
      console.log(`FINALIZE claim=${claimHash} evm=${evmHash}`);
      await retry("finalized receipt", () => sdk.waitForTransactionReceipt({
        hash: claimHash,
        status: TransactionStatus.FINALIZED,
        interval: 5_000,
        retries: 240,
      }));
      return await retry("final claim status", () => sdk.getTransaction({ hash: claimHash }));
    }
    if (attempt % 12 === 0) console.log(`WAIT claim=${claimHash} status=${statusName} execution=${txExecutionResultName}`);
    await delay(5_000);
  }
  throw new Error(`Claim ${claimHash} did not become finalizable within two hours`);
}

async function waitForEscrowTransfer(expectedAtto) {
  for (let attempt = 1; attempt <= 240; attempt += 1) {
    const stats = await readJson("get_dashboard_stats");
    if (BigInt(stats.contractBalanceAtto) <= BigInt(expectedAtto)) return stats;
    if (attempt % 12 === 0) console.log(`WAIT contractBalanceAtto<=${expectedAtto} current=${stats.contractBalanceAtto}`);
    await delay(5_000);
  }
  throw new Error("Finalized settlement did not update the contract balance within 20 minutes");
}

async function submitConfirm() {
  const consensus = testnetBradbury.consensusMainContract;
  if (!consensus?.address || !consensus.abi) throw new Error("Bradbury consensus contract configuration is unavailable");
  const functionName = settlement === "payment" ? "confirm_payment" : "confirm_refund";
  const appCalldata = abi.calldata.encode(abi.calldata.makeCalldataObject(functionName, [dealId]));
  const serializedData = abi.transactions.serialize([appCalldata, false]);
  const data = encodeFunctionData({
    abi: consensus.abi,
    functionName: "addTransaction",
    args: [account.address, contractAddress, testnetBradbury.defaultNumberOfInitialValidators, 5, serializedData, BigInt(Math.floor(Date.now() / 1000) + 3_600)],
  });
  const [nonce, gasPrice] = await Promise.all([
    publicClient.getTransactionCount({ address: account.address }),
    publicClient.getGasPrice(),
  ]);
  const serializedTransaction = await account.signTransaction({
    to: consensus.address,
    data,
    gas: 5_000_000n,
    gasPrice,
    nonce,
    chainId: testnetBradbury.id,
    type: "legacy",
  });
  const evmHash = await publicClient.sendRawTransaction({ serializedTransaction });
  const receipt = await publicClient.waitForTransactionReceipt({ hash: evmHash });
  if (receipt.status !== "success") throw new Error(`Confirm activation reverted: ${evmHash}`);
  const events = parseEventLogs({ abi: consensus.abi, logs: receipt.logs, strict: false });
  const created = events.find((event) => event.eventName === "NewTransaction" || event.eventName === "CreatedTransaction");
  const txId = created?.args?.txId;
  if (typeof txId !== "string") throw new Error(`Confirm activation ${evmHash} did not emit a transaction ID`);
  console.log(`CONFIRM_SUBMITTED function=${functionName} evm=${evmHash} tx=${txId}`);
  return { txId, evmHash };
}

async function waitForConfirmedState(txId, expectedStatus) {
  for (let attempt = 1; attempt <= 360; attempt += 1) {
    const transaction = await retry("confirm status", () => sdk.getTransaction({ hash: txId }));
    if (["UNDETERMINED", "CANCELED", "VALIDATORS_TIMEOUT", "LEADER_TIMEOUT"].includes(transaction.statusName)) {
      throw new Error(`Confirm failed status=${transaction.statusName} execution=${transaction.txExecutionResultName}`);
    }
    if (["ACCEPTED", "READY_TO_FINALIZE", "FINALIZED"].includes(transaction.statusName) && transaction.txExecutionResultName !== "NOT_VOTED") {
      if (transaction.txExecutionResultName !== "FINISHED_WITH_RETURN" || !["AGREE", "MAJORITY_AGREE"].includes(transaction.resultName)) {
        throw new Error(`Confirm failed result=${transaction.resultName} execution=${transaction.txExecutionResultName}`);
      }
      const deal = await readJson("get_deal", [dealId]);
      if (deal.status === expectedStatus) return { transaction, deal };
    }
    if (attempt % 12 === 0) console.log(`WAIT confirm=${txId} status=${transaction.statusName} execution=${transaction.txExecutionResultName}`);
    await delay(5_000);
  }
  throw new Error(`Deal ${dealId} did not reach ${expectedStatus}`);
}

const expectedPending = settlement === "payment" ? "PAYMENT_PENDING" : "REFUND_PENDING";
const expectedComplete = settlement === "payment" ? "PAID" : "REFUNDED";
let deal = await readJson("get_deal", [dealId]);
console.log(`RESUME_START contract=${contractAddress} deal=${dealId} settlement=${settlement} account=${account.address} status=${deal.status}`);
if (deal.status === expectedComplete) {
  console.log(`RESUME_OK deal=${dealId} status=${deal.status} alreadyComplete=true`);
  process.exit(0);
}
if (deal.status !== expectedPending) throw new Error(`Deal ${dealId} must be ${expectedPending}, received ${deal.status}`);

const claim = await waitForClaimFinalization();
console.log(`CLAIM_FINALIZED tx=${claimHash} result=${claim.resultName} execution=${claim.txExecutionResultName}`);
deal = await readJson("get_deal", [dealId]);
await waitForEscrowTransfer(deal.escrowAccountedAfterAtto);
const confirm = await submitConfirm();
const completed = await waitForConfirmedState(confirm.txId, expectedComplete);
const stats = await readJson("get_dashboard_stats");
console.log(`RESUME_OK deal=${dealId} status=${completed.deal.status} claim=${claimHash} confirm=${confirm.txId} stats=${JSON.stringify(stats)}`);
