import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { abi, createClient } from "genlayer-js";
import { testnetBradbury } from "genlayer-js/chains";
import solc from "solc";
import {
  createPublicClient,
  encodeFunctionData,
  formatEther,
  http,
  parseEventLogs,
  zeroAddress
} from "viem";
import { privateKeyToAccount } from "viem/accounts";

const env = readEnv();
const privateKey = env.ACCOUNT1_PRIVATE_KEY || env.ACCOUNT_PRIVATE_KEY;
if (!/^0x[a-fA-F0-9]{64}$/.test(privateKey || "")) throw new Error("Missing valid ACCOUNT1_PRIVATE_KEY");
const deployer = privateKeyToAccount(privateKey);
if (env.EXPECTED_WALLET_ADDRESS && deployer.address.toLowerCase() !== env.EXPECTED_WALLET_ADDRESS.toLowerCase()) {
  throw new Error("ACCOUNT1_PRIVATE_KEY does not match EXPECTED_WALLET_ADDRESS");
}

const publicClient = createPublicClient({ chain: testnetBradbury, transport: http(undefined, { timeout: 30_000, retryCount: 0 }) });
const sdk = createClient({ chain: testnetBradbury });
const consensus = testnetBradbury.consensusMainContract;
if (!consensus?.address || !consensus.abi) throw new Error("Bradbury consensus contract configuration is unavailable");
const checkpointPath = ".codex-runtime/deploy-v2.json";
const resumeDeployment = process.argv.includes("--resume");
mkdirSync(".codex-runtime", { recursive: true });
const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
const transient = (error) => /internal error|fetch failed|timeout|timed out|econnreset|etimedout|network error|socket hang up|pipeline backpressure|not currently accepting transactions|request exceeds defined limit|gas rate limit exceeded|node is at capacity/i.test(error instanceof Error ? error.message : String(error));

const balance = await retryRpc("BALANCE", () => publicClient.getBalance({ address: deployer.address }));
console.log(`DEPLOYER_ADDRESS=${deployer.address}`);
console.log(`DEPLOYER_BALANCE=${formatEther(balance)} GEN`);
if (balance < 100_000_000_000_000_000n) throw new Error("Deployer balance is below 0.1 GEN");

const routerArtifact = compileRouter();
let routerAddress;
let txId;
if (resumeDeployment) {
  const checkpoint = readCheckpoint();
  const routerRecord = checkpoint.records?.findLast((entry) => entry.phase === "ROUTER_DEPLOYED");
  const activationRecord = checkpoint.records?.findLast((entry) => entry.phase === "CLAUSEFLOW_ACTIVATED");
  if (!routerRecord?.routerAddress || !activationRecord?.transactionHash) throw new Error("Resume requires ROUTER_DEPLOYED and CLAUSEFLOW_ACTIVATED checkpoint records");
  routerAddress = routerRecord.routerAddress;
  txId = activationRecord.transactionHash;
  if (activationRecord.routerAddress?.toLowerCase() !== routerAddress.toLowerCase()) throw new Error("Deployment checkpoint router mismatch");
  console.log("RESUME_DEPLOYMENT=true");
  console.log(`SETTLEMENT_ROUTER=${routerAddress}`);
  console.log(`ROUTER_DEPLOY_HASH=${routerRecord.evmHash}`);
  console.log(`DEPLOY_EVM_HASH=${activationRecord.activationHash}`);
  console.log(`DEPLOY_TX_HASH=${txId}`);
} else {
  if (readCheckpoint().records?.some((entry) => entry.phase === "CLAUSEFLOW_ACTIVATED")) {
    throw new Error("An activated deployment checkpoint already exists; use --resume instead of creating a duplicate deployment");
  }
  const routerDeployment = await sendEvmTransaction({ data: routerArtifact.bytecode, label: "ROUTER_DEPLOY" });
  routerAddress = routerDeployment.receipt.contractAddress;
  if (!routerAddress || routerAddress === zeroAddress) throw new Error("Router deployment did not return a contract address");
  record({ phase: "ROUTER_DEPLOYED", routerAddress, evmHash: routerDeployment.hash, blockNumber: routerDeployment.receipt.blockNumber.toString() });
  console.log(`SETTLEMENT_ROUTER=${routerAddress}`);
  console.log(`ROUTER_DEPLOY_HASH=${routerDeployment.hash}`);

  const contractCode = readFileSync("contracts/clauseflow.py");
  const constructorCalldata = abi.calldata.encode(abi.calldata.makeCalldataObject(undefined, [routerAddress], undefined));
  const serializedData = abi.transactions.serialize([contractCode, constructorCalldata, false]);
  const activationData = encodeFunctionData({
    abi: consensus.abi,
    functionName: "addTransaction",
    args: [
      deployer.address,
      zeroAddress,
      BigInt(testnetBradbury.defaultNumberOfInitialValidators),
      5n,
      serializedData,
      BigInt(Math.floor(Date.now() / 1000) + 3600)
    ]
  });
  const activation = await sendEvmTransaction({ to: consensus.address, data: activationData, label: "CLAUSEFLOW_ACTIVATION", maximumGas: 99_000_000n });
  const events = parseEventLogs({ abi: consensus.abi, logs: activation.receipt.logs, strict: false });
  const created = events.find((event) => event.eventName === "NewTransaction" || event.eventName === "CreatedTransaction");
  txId = created?.args?.txId;
  if (typeof txId !== "string") throw new Error(`Deployment activation did not emit a transaction ID: ${activation.hash}`);
  record({ phase: "CLAUSEFLOW_ACTIVATED", routerAddress, activationHash: activation.hash, transactionHash: txId });
  console.log(`DEPLOY_EVM_HASH=${activation.hash}`);
  console.log(`DEPLOY_TX_HASH=${txId}`);
}

let transaction = await waitForGenLayerExecution(txId);
const contractAddress = transaction.recipient;
if (!/^0x[a-fA-F0-9]{40}$/.test(contractAddress) || contractAddress === zeroAddress) throw new Error("Deployment did not return a contract address");
console.log(`DEPLOY_STATUS=${transaction.statusName}`);
console.log(`DEPLOY_RESULT=${transaction.resultName}`);
console.log(`DEPLOY_EXECUTION=${transaction.txExecutionResultName}`);
console.log(`CONTRACT_ADDRESS=${contractAddress}`);

transaction = await waitForGenLayerFinality(txId, transaction);
record({
  phase: "CLAUSEFLOW_FINALIZED",
  contractAddress,
  routerAddress,
  transactionHash: txId,
  lifecycle: transaction.statusName,
  consensus: transaction.resultName,
  execution: transaction.txExecutionResultName
});

const existingBinding = await retryRpc("ROUTER_BINDING", () => publicClient.readContract({ address: routerAddress, abi: routerArtifact.abi, functionName: "clauseFlow" }));
if (existingBinding === zeroAddress) {
  const bindData = encodeFunctionData({ abi: routerArtifact.abi, functionName: "bind_clauseflow", args: [contractAddress] });
  const binding = await sendEvmTransaction({ to: routerAddress, data: bindData, label: "ROUTER_BIND" });
  record({ phase: "ROUTER_BOUND", contractAddress, routerAddress, evmHash: binding.hash, blockNumber: binding.receipt.blockNumber.toString() });
  console.log(`ROUTER_BIND_HASH=${binding.hash}`);
} else if (existingBinding.toLowerCase() !== contractAddress.toLowerCase()) {
  throw new Error(`Router is already bound to a different ClauseFlow contract: ${existingBinding}`);
} else {
  console.log("ROUTER_ALREADY_BOUND=true");
}

const [schema, offerIds, dealIds, policy, boundClauseFlow, routerOwner] = await retryRpc("VERIFY_RELEASE", async () => {
  const [nextSchema, nextOfferIds, nextDealIds, nextPolicy, nextBoundClauseFlow, nextRouterOwner] = await Promise.all([
    sdk.getContractSchema(contractAddress),
    sdk.readContract({ address: contractAddress, functionName: "get_offer_ids", args: [], transactionHashVariant: "latest-nonfinal" }),
    sdk.readContract({ address: contractAddress, functionName: "get_deal_ids", args: [], transactionHashVariant: "latest-nonfinal" }),
    sdk.readContract({ address: contractAddress, functionName: "get_protocol_policy", args: [], transactionHashVariant: "latest-nonfinal" }),
    publicClient.readContract({ address: routerAddress, abi: routerArtifact.abi, functionName: "clauseFlow" }),
    publicClient.readContract({ address: routerAddress, abi: routerArtifact.abi, functionName: "owner" })
  ]);
  return [nextSchema, nextOfferIds, nextDealIds, nextPolicy, nextBoundClauseFlow, nextRouterOwner];
}, 24, 10_000);

const methodCount = Object.keys(schema?.methods || {}).length;
const parsedPolicy = typeof policy === "string" ? JSON.parse(policy) : policy;
if (methodCount !== 21) throw new Error(`Expected 21 schema methods, received ${methodCount}`);
if (String(offerIds) !== "[]" || String(dealIds) !== "[]") throw new Error(`Expected clean state, received offers=${offerIds} deals=${dealIds}`);
if (parsedPolicy.protocolVersion !== "CLAUSEFLOW_V2") throw new Error(`Unexpected protocol version ${parsedPolicy.protocolVersion}`);
if (parsedPolicy.settlementRouter.toLowerCase() !== routerAddress.toLowerCase()) throw new Error("ClauseFlow policy does not bind the deployed router");
if (boundClauseFlow.toLowerCase() !== contractAddress.toLowerCase()) throw new Error("Router is not bound to the deployed ClauseFlow contract");
if (routerOwner.toLowerCase() !== deployer.address.toLowerCase()) throw new Error("Router owner does not match the deployer");

record({ phase: "DEPLOYMENT_VERIFIED", contractAddress, routerAddress, methodCount, offerIds: [], dealIds: [], protocolVersion: parsedPolicy.protocolVersion });
console.log(`SCHEMA_METHODS=${methodCount}`);
console.log(`PROTOCOL_VERSION=${parsedPolicy.protocolVersion}`);
console.log(`BASIC_VIEW_GET_OFFER_IDS=${offerIds}`);
console.log(`BASIC_VIEW_GET_DEAL_IDS=${dealIds}`);
console.log("DEPLOY_VERIFIED=true");

function readEnv() {
  return Object.fromEntries(
    readFileSync(".env", "utf8")
      .split(/\r?\n/)
      .filter((line) => /^\s*[A-Za-z_][A-Za-z0-9_]*\s*=/.test(line))
      .map((line) => {
        const index = line.indexOf("=");
        return [line.slice(0, index).trim(), line.slice(index + 1).trim().replace(/^["']|["']$/g, "")];
      })
  );
}

function compileRouter() {
  const fileName = "SettlementRouter.sol";
  const input = {
    language: "Solidity",
    sources: { [fileName]: { content: readFileSync(`contracts/${fileName}`, "utf8") } },
    settings: {
      optimizer: { enabled: true, runs: 200 },
      evmVersion: "paris",
      outputSelection: { "*": { "*": ["abi", "evm.bytecode.object"] } }
    }
  };
  const output = JSON.parse(solc.compile(JSON.stringify(input)));
  const errors = (output.errors || []).filter((entry) => entry.severity === "error");
  if (errors.length) throw new Error(errors.map((entry) => entry.formattedMessage).join("\n"));
  const artifact = output.contracts[fileName].ClauseFlowSettlementRouter;
  return { abi: artifact.abi, bytecode: `0x${artifact.evm.bytecode.object}` };
}

async function sendEvmTransaction({ to, data, label, value = 0n, maximumGas = 12_000_000n }) {
  const nonce = await retryRpc(`${label}_NONCE`, () => publicClient.getTransactionCount({ address: deployer.address, blockTag: "pending" }));
  const gasPrice = await retryRpc(`${label}_GAS_PRICE`, () => publicClient.getGasPrice());
  const estimate = await retryRpc(`${label}_GAS_ESTIMATE`, () => publicClient.estimateGas({ account: deployer.address, to, data, value }));
  const padded = estimate + estimate / 5n + 150_000n;
  if (padded > maximumGas) throw new Error(`${label} gas estimate ${estimate} exceeds safe limit ${maximumGas}`);
  const serializedTransaction = await deployer.signTransaction({ to, data, value, gas: padded, gasPrice, nonce, chainId: testnetBradbury.id, type: "legacy" });
  const hash = await retryRpc(`${label}_SUBMIT`, () => publicClient.sendRawTransaction({ serializedTransaction }));
  const receipt = await publicClient.waitForTransactionReceipt({ hash, confirmations: 1 });
  if (receipt.status !== "success") throw new Error(`${label} reverted: ${hash}`);
  return { hash, receipt };
}

async function waitForGenLayerExecution(transactionHash) {
  for (let attempt = 1; attempt <= 2160; attempt += 1) {
    const current = await retryRpc("DEPLOY_STATUS", () => sdk.getTransaction({ hash: transactionHash }));
    const status = current.statusName;
    const execution = current.txExecutionResultName;
    if (["UNDETERMINED", "CANCELED"].includes(status)) throw new Error(`Deployment ended with status=${status} execution=${execution}`);
    if (["ACCEPTED", "READY_TO_FINALIZE", "FINALIZED"].includes(status) && execution !== "NOT_VOTED") {
      if (execution !== "FINISHED_WITH_RETURN") throw new Error(`Deployment execution=${execution}`);
      if (!["AGREE", "MAJORITY_AGREE"].includes(current.resultName)) throw new Error(`Deployment consensus=${current.resultName}`);
      return current;
    }
    if (attempt % 12 === 0) console.log(`WAIT_DEPLOY status=${status} execution=${execution}`);
    await delay(5_000);
  }
  throw new Error(`Deployment did not reach successful execution: ${transactionHash}`);
}

async function waitForGenLayerFinality(transactionHash, current) {
  for (let attempt = 1; attempt <= 2160 && current.statusName !== "FINALIZED"; attempt += 1) {
    await delay(5_000);
    current = await retryRpc("DEPLOY_FINALITY", () => sdk.getTransaction({ hash: transactionHash }));
    if (["UNDETERMINED", "CANCELED"].includes(current.statusName)) throw new Error(`Deployment finality failed: ${current.statusName}`);
    if (attempt % 12 === 0) console.log(`WAIT_DEPLOY_FINALITY status=${current.statusName}`);
  }
  if (current.statusName !== "FINALIZED") throw new Error(`Deployment did not finalize: ${transactionHash}`);
  return current;
}

function record(entry) {
  let checkpoint = { version: 2, network: "testnetBradbury", updatedAt: new Date().toISOString(), records: [] };
  try { checkpoint = JSON.parse(readFileSync(checkpointPath, "utf8")); } catch { /* New deployment journal. */ }
  checkpoint.updatedAt = new Date().toISOString();
  checkpoint.records = [...(checkpoint.records || []), { ...entry, recordedAt: new Date().toISOString() }];
  writeFileSync(checkpointPath, JSON.stringify(checkpoint, null, 2));
}

function readCheckpoint() {
  try { return JSON.parse(readFileSync(checkpointPath, "utf8")); } catch { return { version: 2, network: "testnetBradbury", records: [] }; }
}

async function retryRpc(label, operation, attempts = 12, waitMs = 5_000) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try { return await operation(); } catch (error) {
      lastError = error;
      if (!transient(error) || attempt === attempts) throw error;
      console.log(`RETRY_${label} (${attempt}/${attempts})`);
      await delay(waitMs);
    }
  }
  throw lastError;
}
