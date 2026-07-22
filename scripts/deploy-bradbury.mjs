import { readFileSync } from "node:fs";
import { abi, createClient } from "genlayer-js";
import { testnetBradbury } from "genlayer-js/chains";
import { createPublicClient, encodeFunctionData, formatEther, http, parseEventLogs, zeroAddress } from "viem";
import { privateKeyToAccount } from "viem/accounts";

const env = Object.fromEntries(
  readFileSync(".env", "utf8")
    .split(/\r?\n/)
    .filter((line) => /^\s*[A-Za-z_][A-Za-z0-9_]*\s*=/.test(line))
    .map((line) => {
      const index = line.indexOf("=");
      return [line.slice(0, index).trim(), line.slice(index + 1).trim().replace(/^["']|["']$/g, "")];
    })
);

const privateKey = env.ACCOUNT1_PRIVATE_KEY || env.ACCOUNT_PRIVATE_KEY;
if (!/^0x[a-fA-F0-9]{64}$/.test(privateKey || "")) throw new Error("Missing valid ACCOUNT1_PRIVATE_KEY");
const deployer = privateKeyToAccount(privateKey);
if (env.EXPECTED_WALLET_ADDRESS && deployer.address.toLowerCase() !== env.EXPECTED_WALLET_ADDRESS.toLowerCase()) {
  throw new Error("ACCOUNT1_PRIVATE_KEY does not match EXPECTED_WALLET_ADDRESS");
}

const publicClient = createPublicClient({ chain: testnetBradbury, transport: http() });
const sdk = createClient({ chain: testnetBradbury });
const balance = await publicClient.getBalance({ address: deployer.address });
console.log(`DEPLOYER_ADDRESS=${deployer.address}`);
console.log(`DEPLOYER_BALANCE=${formatEther(balance)} GEN`);
if (balance < 100_000_000_000_000_000n) throw new Error("Deployer balance is below 0.1 GEN");

const contractCode = readFileSync("contracts/clauseflow.py");
const constructorCalldata = abi.calldata.encode(abi.calldata.makeCalldataObject(undefined, [], undefined));
const serializedData = abi.transactions.serialize([contractCode, constructorCalldata, false]);
const consensus = testnetBradbury.consensusMainContract;
if (!consensus?.address || !consensus.abi) throw new Error("Bradbury consensus contract configuration is unavailable");
const encodedData = encodeFunctionData({
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
const [nonce, gasPrice] = await Promise.all([
  publicClient.getTransactionCount({ address: deployer.address }),
  publicClient.getGasPrice()
]);
const signed = await deployer.signTransaction({
  to: consensus.address,
  data: encodedData,
  value: 0n,
  gas: 5_000_000n,
  gasPrice,
  nonce,
  chainId: testnetBradbury.id,
  type: "legacy"
});
const evmHash = await publicClient.sendRawTransaction({ serializedTransaction: signed });
const activationReceipt = await publicClient.waitForTransactionReceipt({ hash: evmHash });
if (activationReceipt.status !== "success") throw new Error(`Deployment activation reverted: ${evmHash}`);
const events = parseEventLogs({ abi: consensus.abi, logs: activationReceipt.logs, strict: false });
const created = events.find((event) => event.eventName === "NewTransaction" || event.eventName === "CreatedTransaction");
const txId = created?.args?.txId;
if (typeof txId !== "string") throw new Error(`Deployment activation did not emit a transaction ID: ${evmHash}`);
console.log(`DEPLOY_EVM_HASH=${evmHash}`);
console.log(`DEPLOY_TX_HASH=${txId}`);

let transaction;
for (let attempt = 1; attempt <= 360; attempt += 1) {
  transaction = await sdk.getTransaction({ hash: txId });
  const status = transaction.statusName;
  const execution = transaction.txExecutionResultName;
  if (["UNDETERMINED", "CANCELED", "VALIDATORS_TIMEOUT", "LEADER_TIMEOUT"].includes(status)) {
    throw new Error(`Deployment ended with status=${status} execution=${execution}`);
  }
  if (["ACCEPTED", "READY_TO_FINALIZE", "FINALIZED"].includes(status) && execution !== "NOT_VOTED") break;
  if (attempt % 12 === 0) console.log(`WAIT_DEPLOY status=${status} execution=${execution}`);
  await new Promise((resolve) => setTimeout(resolve, 5_000));
}
if (!transaction || transaction.txExecutionResultName !== "FINISHED_WITH_RETURN") {
  throw new Error(`Deployment execution=${transaction?.txExecutionResultName || "unavailable"}`);
}
if (!["AGREE", "MAJORITY_AGREE"].includes(transaction.resultName)) throw new Error(`Deployment consensus=${transaction.resultName}`);
const contractAddress = transaction.recipient;
if (!/^0x[a-fA-F0-9]{40}$/.test(contractAddress) || contractAddress === zeroAddress) throw new Error("Deployment did not return a contract address");
console.log(`DEPLOY_STATUS=${transaction.statusName}`);
console.log(`DEPLOY_RESULT=${transaction.resultName}`);
console.log(`DEPLOY_EXECUTION=${transaction.txExecutionResultName}`);
console.log(`CONTRACT_ADDRESS=${contractAddress}`);

let schema;
let offerIds;
for (let attempt = 1; attempt <= 30; attempt += 1) {
  try {
    [schema, offerIds] = await Promise.all([
      sdk.getContractSchema(contractAddress),
      sdk.readContract({ address: contractAddress, functionName: "get_offer_ids", args: [] })
    ]);
    break;
  } catch (error) {
    if (attempt === 30) throw error;
    await new Promise((resolve) => setTimeout(resolve, 3_000));
  }
}
const methodCount = Object.keys(schema?.methods || {}).length;
if (methodCount !== 18) throw new Error(`Expected 18 schema methods, received ${methodCount}`);
if (String(offerIds) !== "[]") throw new Error(`Expected clean offer ids, received ${offerIds}`);
console.log(`SCHEMA_METHODS=${methodCount}`);
console.log(`BASIC_VIEW_GET_OFFER_IDS=${offerIds}`);
console.log("DEPLOY_VERIFIED=true");
