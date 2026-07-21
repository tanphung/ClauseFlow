import { createClient } from "genlayer-js";
import { studionet, testnetBradbury } from "genlayer-js/chains";
import type { CalldataEncodable } from "genlayer-js/types";

export type ClauseFlowConfig = {
  contractAddress: string;
  chain: "testnetBradbury" | "studionet";
  explorerUrl: string;
  stateStatus?: "accepted" | "finalized";
};

export function hasContractAddress(config: ClauseFlowConfig | null | undefined) {
  return Boolean(config?.contractAddress && /^0x[a-fA-F0-9]{40}$/.test(config.contractAddress));
}

export function createReadClient(config: ClauseFlowConfig) {
  const chain = config.chain === "studionet" ? studionet : testnetBradbury;
  return createClient({ chain });
}

function addWriteGasMargin<T extends { estimateTransactionGas: (...args: never[]) => Promise<bigint> }>(client: T): T {
  const estimateTransactionGas = client.estimateTransactionGas.bind(client);
  client.estimateTransactionGas = (async (...args: never[]) => {
    const estimate = await estimateTransactionGas(...args);
    const buffered = (estimate * 6n) + 1_000_000n;
    return buffered > 5_000_000n ? buffered : 5_000_000n;
  }) as T["estimateTransactionGas"];
  return client;
}

type WalletProvider = {
  request(args: { method: string; params?: unknown[] }): Promise<unknown>;
};

export function getWalletProvider(): WalletProvider | null {
  return (window as unknown as { ethereum?: WalletProvider }).ethereum || null;
}

export function normalizeError(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string") return error;
  if (error && typeof error === "object") {
    const record = error as Record<string, unknown>;
    for (const key of ["shortMessage", "details", "message", "reason"]) {
      if (typeof record[key] === "string" && record[key]) return record[key] as string;
    }
    try {
      const serialized = JSON.stringify(record);
      if (serialized && serialized !== "{}") return serialized;
    } catch {
      return "Transaction failed with an unreadable wallet or RPC error object.";
    }
  }
  return String(error || "Unknown error");
}

export async function connectWallet(config: ClauseFlowConfig) {
  const provider = getWalletProvider();
  if (!provider) throw new Error("No compatible browser wallet was found.");
  const accounts = (await provider.request({ method: "eth_requestAccounts" })) as string[];
  const address = accounts[0];
  if (!address) throw new Error("The wallet did not return an account.");
  const chain = config.chain === "studionet" ? studionet : testnetBradbury;
  const client = addWriteGasMargin(createClient({
    chain,
    account: address as `0x${string}`,
    provider: provider as never
  }));
  await client.connect(config.chain === "studionet" ? "studionet" : "testnetBradbury");
  return { client, address };
}

type ConnectedClient = Awaited<ReturnType<typeof connectWallet>>["client"];
type TransactionHash = Parameters<ConnectedClient["getTransaction"]>[0]["hash"];

async function waitForAcceptedExecution(client: ConnectedClient, hash: TransactionHash) {
  let transientFailures = 0;
  for (let attempt = 1; attempt <= 360; attempt += 1) {
    let transaction: Awaited<ReturnType<typeof client.getTransaction>>;
    try {
      transaction = await client.getTransaction({ hash });
      transientFailures = 0;
    } catch (error) {
      const message = normalizeError(error);
      if (!message.includes("Internal error") || transientFailures >= 12) throw error;
      transientFailures += 1;
      await new Promise((resolve) => window.setTimeout(resolve, 5_000));
      continue;
    }
    const status = transaction.statusName || String(transaction.status || "UNINITIALIZED");
    const execution = transaction.txExecutionResultName || "NOT_VOTED";
    if (["UNDETERMINED", "CANCELED", "VALIDATORS_TIMEOUT", "LEADER_TIMEOUT"].includes(status)) {
      throw new Error(`${status}: transaction ended before successful execution (${execution}).`);
    }
    if (["ACCEPTED", "READY_TO_FINALIZE", "FINALIZED"].includes(status) && execution !== "NOT_VOTED") {
      return transaction;
    }
    await new Promise((resolve) => window.setTimeout(resolve, 5_000));
  }
  throw new Error("Transaction did not produce an execution result before the wait limit.");
}

export async function writeAndVerify(
  config: ClauseFlowConfig,
  functionName: string,
  args: CalldataEncodable[],
  value: bigint = 0n,
  onSubmitted?: (hash: string) => void
) {
  if (!hasContractAddress(config)) throw new Error("ClauseFlow contract address is not configured.");
  const { client, address } = await connectWallet(config);
  const aiMethod = functionName === "structure_offer";
  const writeParams = {
    address: config.contractAddress as `0x${string}`,
    functionName,
    args,
    value,
    consensusMaxRotations: 5
  };
  const params = aiMethod ? {
    ...writeParams,
    fees: {
      distribution: {
        leaderTimeunitsAllocation: "500",
        validatorTimeunitsAllocation: "500",
        rotations: ["0", "1", "2", "3", "4"]
      }
    }
  } : writeParams;
  const hash = await client.writeContract(params as Parameters<typeof client.writeContract>[0]);
  onSubmitted?.(hash);
  const receipt = await waitForAcceptedExecution(client, hash);
  const executionResult = receipt.txExecutionResultName || "NOT_VOTED";
  if (executionResult !== "FINISHED_WITH_RETURN") {
    throw new Error(`${executionResult}: contract execution did not succeed.`);
  }
  const consensusResult = receipt.resultName || "IDLE";
  if (!["AGREE", "MAJORITY_AGREE"].includes(consensusResult)) {
    throw new Error(`CONSENSUS_${consensusResult}: execution returned but the agreed state was not applied.`);
  }
  const childTransactions = [...new Set(await client.getTriggeredTransactionIds({ hash }))].filter((childHash) => childHash !== hash);
  return {
    hash,
    address,
    lifecycle: receipt.statusName || String(receipt.status || "ACCEPTED"),
    executionResult,
    consensusResult,
    childTransactions
  };
}

export async function readJsonView<T>(client: ReturnType<typeof createReadClient>, config: ClauseFlowConfig, functionName: string, args: CalldataEncodable[]): Promise<T> {
  let result: unknown;
  let lastError: unknown;
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      result = await withTimeout(
        client.readContract({
          address: config.contractAddress as `0x${string}`,
          functionName,
          args
        }),
        8_000,
        `${functionName} timed out while reading Bradbury state`
      );
      break;
    } catch (error) {
      lastError = error;
      const message = normalizeError(error);
      if (!(message.includes("Internal error") || message.includes("timed out")) || attempt === 2) throw error;
      await new Promise((resolve) => window.setTimeout(resolve, 2_000));
    }
  }
  if (result === undefined) throw lastError instanceof Error ? lastError : new Error(normalizeError(lastError) || `${functionName} returned no data.`);
  if (typeof result === "string") {
    return JSON.parse(result) as T;
  }
  return result as T;
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error(message)), timeoutMs);
    promise.then(
      (value) => {
        window.clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        window.clearTimeout(timer);
        reject(error);
      }
    );
  });
}

export function explorerAddressUrl(config: ClauseFlowConfig, address: string) {
  return `${config.explorerUrl.replace(/\/$/, "")}/address/${address}`;
}

export function explorerTxUrl(config: ClauseFlowConfig, hash: string) {
  return `${config.explorerUrl.replace(/\/$/, "")}/tx/${hash}`;
}
