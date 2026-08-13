import { abi, createClient } from "genlayer-js";
import { studionet, testnetBradbury } from "genlayer-js/chains";
import { TransactionHashVariant, type CalldataEncodable } from "genlayer-js/types";
import { createPublicClient as createViemPublicClient, encodeFunctionData, http, parseEventLogs, toHex, type Hash } from "viem";

export type ClauseFlowConfig = {
  contractAddress: string;
  chain: "testnetBradbury" | "studionet";
  explorerUrl: string;
  stateStatus?: "accepted" | "finalized";
};

export function hasContractAddress(config: ClauseFlowConfig | null | undefined) {
  return Boolean(config?.contractAddress && /^0x[a-fA-F0-9]{40}$/.test(config.contractAddress));
}

export function isTerminalTransactionFailure(status: string) {
  return status === "UNDETERMINED" || status === "CANCELED";
}

export function createReadClient(config: ClauseFlowConfig) {
  const chain = config.chain === "studionet" ? studionet : testnetBradbury;
  return createClient({ chain });
}

export type WalletProvider = {
  request(args: { method: string; params?: unknown[] }): Promise<unknown>;
  isMetaMask?: boolean;
  providers?: WalletProvider[];
};

export function getWalletProvider(): WalletProvider | null {
  const injected = (window as unknown as { ethereum?: WalletProvider }).ethereum;
  if (!injected) return null;
  const providers = injected.providers?.length ? injected.providers : [injected];
  return providers.find((provider) => provider.isMetaMask) || providers[0] || null;
}

type AnnouncedProvider = {
  info?: { rdns?: string; name?: string };
  provider?: WalletProvider;
};

export async function discoverWalletProvider(waitMs = 120): Promise<WalletProvider | null> {
  const providers: Array<{ provider: WalletProvider; rdns: string }> = [];
  const add = (provider: WalletProvider | undefined, rdns = "") => {
    if (!provider) return;
    const existing = providers.find((candidate) => candidate.provider === provider);
    if (existing) {
      if (rdns) existing.rdns = rdns;
      return;
    }
    providers.push({ provider, rdns });
  };
  const injected = (window as unknown as { ethereum?: WalletProvider }).ethereum;
  for (const provider of injected?.providers || []) add(provider);
  add(injected);

  const onAnnouncement = (event: Event) => {
    const detail = (event as CustomEvent<AnnouncedProvider>).detail;
    add(detail?.provider, detail?.info?.rdns || "");
  };
  window.addEventListener("eip6963:announceProvider", onAnnouncement);
  window.dispatchEvent(new Event("eip6963:requestProvider"));
  await new Promise((resolve) => window.setTimeout(resolve, waitMs));
  window.removeEventListener("eip6963:announceProvider", onAnnouncement);

  const preferred = providers.find(({ rdns }) => rdns.toLowerCase() === "io.metamask")
    || providers.find(({ provider }) => provider.isMetaMask);
  return preferred?.provider || providers[0]?.provider || null;
}

export function normalizeError(error: unknown): string {
  const walletCode = walletErrorCode(error);
  if (walletCode === 4001) return "Wallet request was rejected. Open the wallet and approve the connection when you are ready.";
  if (walletCode === -32002) return "A wallet request is already pending. Open the wallet extension and complete or reject it, then try again.";
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

function walletErrorCode(error: unknown): number | undefined {
  if (!error || typeof error !== "object") return undefined;
  const record = error as Record<string, unknown>;
  if (typeof record.code === "number") return record.code;
  return walletErrorCode(record.cause);
}

function isTransientBradburyRpcError(error: unknown) {
  return /internal error|fetch failed|econnreset|etimedout|network error|socket hang up|pipeline backpressure|not currently accepting transactions/i.test(normalizeError(error));
}

export async function connectWallet(config: ClauseFlowConfig) {
  const provider = await discoverWalletProvider();
  if (!provider) throw new Error("No compatible browser wallet was found.");
  const accounts = (await provider.request({ method: "eth_requestAccounts" })) as string[];
  const address = accounts[0];
  if (!address) throw new Error("The wallet did not return an account.");
  const chain = config.chain === "studionet" ? studionet : testnetBradbury;
  await ensureWalletNetwork(provider, chain);
  const client = createClient({
    chain,
    account: address as `0x${string}`,
    provider: provider as never
  });
  if (config.chain === "studionet") await client.connect("studionet");
  return { client, address, provider };
}

async function ensureWalletNetwork(provider: WalletProvider, chain: typeof testnetBradbury | typeof studionet) {
  const chainId = `0x${chain.id.toString(16)}`;
  const currentChainId = String(await provider.request({ method: "eth_chainId" })).toLowerCase();
  if (currentChainId === chainId) return;
  try {
    await provider.request({ method: "wallet_switchEthereumChain", params: [{ chainId }] });
    return;
  } catch (error) {
    const message = normalizeError(error);
    const missingChain = walletErrorCode(error) === 4902 || /unrecognized chain|unknown chain|not added/i.test(message);
    if (!missingChain) throw new Error(`Could not switch the wallet to ${chain.name}: ${message}`);
  }
  await provider.request({
    method: "wallet_addEthereumChain",
    params: [{
      chainId,
      chainName: chain.name,
      rpcUrls: [...chain.rpcUrls.default.http],
      nativeCurrency: chain.nativeCurrency,
      blockExplorerUrls: chain.blockExplorers?.default.url ? [chain.blockExplorers.default.url] : []
    }]
  });
  await provider.request({ method: "wallet_switchEthereumChain", params: [{ chainId }] });
}

type ConnectedClient = Awaited<ReturnType<typeof connectWallet>>["client"];
type TransactionHash = Parameters<ConnectedClient["getTransaction"]>[0]["hash"];

async function submitBradburyWrite(
  provider: WalletProvider,
  address: string,
  contractAddress: string,
  functionName: string,
  args: CalldataEncodable[],
  value: bigint
): Promise<TransactionHash> {
  const consensus = testnetBradbury.consensusMainContract;
  if (!consensus?.address || !consensus.abi) throw new Error("Bradbury consensus contract configuration is unavailable.");
  const appCalldata = abi.calldata.encode(abi.calldata.makeCalldataObject(functionName, args, undefined));
  const serializedData = abi.transactions.serialize([appCalldata, false]);
  const encodedData = encodeFunctionData({
    abi: consensus.abi,
    functionName: "addTransaction",
    args: [
      address as `0x${string}`,
      contractAddress as `0x${string}`,
      BigInt(testnetBradbury.defaultNumberOfInitialValidators),
      5n,
      serializedData,
      BigInt(Math.floor(Date.now() / 1000) + 3600)
    ]
  });
  const evmHash = await provider.request({
    method: "eth_sendTransaction",
    params: [{
      from: address,
      to: consensus.address,
      data: encodedData,
      value: toHex(value),
      gas: toHex(5_000_000n)
    }]
  }) as Hash;
  const publicClient = createViemPublicClient({
    chain: testnetBradbury,
    transport: http(undefined, { timeout: 30_000, retryCount: 0 })
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash: evmHash });
  if (receipt.status !== "success") throw new Error(`Consensus activation reverted after using ${receipt.gasUsed} gas: ${evmHash}`);
  const events = parseEventLogs({ abi: consensus.abi, logs: receipt.logs, strict: false }) as unknown as Array<{ eventName: string; args?: { txId?: string } }>;
  const created = events.find((event) => event.eventName === "NewTransaction" || event.eventName === "CreatedTransaction");
  const txId = created?.args?.txId;
  if (!txId) throw new Error(`Consensus activation ${evmHash} did not emit a transaction ID.`);
  return txId as TransactionHash;
}

async function waitForAcceptedExecution(client: ConnectedClient, hash: TransactionHash) {
  let transientFailures = 0;
  for (let attempt = 1; attempt <= 2160; attempt += 1) {
    let transaction: Awaited<ReturnType<typeof client.getTransaction>>;
    try {
      transaction = await client.getTransaction({ hash });
      transientFailures = 0;
    } catch (error) {
      if (!isTransientBradburyRpcError(error) || transientFailures >= 12) throw error;
      transientFailures += 1;
      await new Promise((resolve) => window.setTimeout(resolve, 5_000));
      continue;
    }
    const status = transaction.statusName || String(transaction.status || "UNINITIALIZED");
    const execution = transaction.txExecutionResultName || "NOT_VOTED";
    if (isTerminalTransactionFailure(status)) {
      throw new Error(`${status}: transaction ended before successful execution (${execution}).`);
    }
    if (["ACCEPTED", "READY_TO_FINALIZE", "FINALIZED"].includes(status) && execution !== "NOT_VOTED") {
      return transaction;
    }
    await new Promise((resolve) => window.setTimeout(resolve, 5_000));
  }
  throw new Error("Transaction did not reach accepted consensus before the three-hour polling window ended.");
}

export async function writeAndVerify(
  config: ClauseFlowConfig,
  functionName: string,
  args: CalldataEncodable[],
  value: bigint = 0n,
  onSubmitted?: (hash: string) => void
) {
  if (!hasContractAddress(config)) throw new Error("ClauseFlow contract address is not configured.");
  const { client, address, provider } = await connectWallet(config);
  const writeParams = {
    address: config.contractAddress as `0x${string}`,
    functionName,
    args,
    value,
    consensusMaxRotations: 5
  };
  const hash = config.chain === "testnetBradbury"
    ? await submitBradburyWrite(provider, address, config.contractAddress, functionName, args, value)
    : await client.writeContract(writeParams as Parameters<typeof client.writeContract>[0]);
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
          args,
          transactionHashVariant: config.stateStatus === "finalized"
            ? TransactionHashVariant.LATEST_FINAL
            : TransactionHashVariant.LATEST_NONFINAL
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
