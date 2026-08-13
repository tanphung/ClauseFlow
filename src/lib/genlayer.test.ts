import { afterEach, describe, expect, it, vi } from "vitest";
import { connectWallet, discoverWalletProvider, normalizeError, type ClauseFlowConfig, type WalletProvider } from "./genlayer";

const config: ClauseFlowConfig = {
  contractAddress: "0x3333333333333333333333333333333333333333",
  chain: "testnetBradbury",
  explorerUrl: "https://explorer-bradbury.genlayer.com"
};

function setInjectedProvider(provider?: WalletProvider) {
  Object.defineProperty(window, "ethereum", { configurable: true, value: provider });
}

afterEach(() => {
  setInjectedProvider(undefined);
  vi.restoreAllMocks();
});

describe("wallet connection", () => {
  it("prefers MetaMask when multiple injected wallets are installed", async () => {
    const first = { request: vi.fn(), isMetaMask: true } as unknown as WalletProvider;
    const metamask = { request: vi.fn(), isMetaMask: true } as unknown as WalletProvider;
    setInjectedProvider({ request: vi.fn(), providers: [first, metamask] });
    window.addEventListener("eip6963:requestProvider", () => {
      window.dispatchEvent(new CustomEvent("eip6963:announceProvider", {
        detail: { info: { rdns: "io.metamask", name: "MetaMask" }, provider: metamask }
      }));
    }, { once: true });

    expect(await discoverWalletProvider(0)).toBe(metamask);
  });

  it("connects on Bradbury without requesting a MetaMask Snap", async () => {
    const methods: string[] = [];
    const provider: WalletProvider = {
      isMetaMask: true,
      request: vi.fn(async ({ method }) => {
        methods.push(method);
        if (method === "eth_requestAccounts") return ["0x1111111111111111111111111111111111111111"];
        if (method === "eth_chainId") return "0x107d";
        throw new Error(`Unexpected wallet method: ${method}`);
      })
    };
    setInjectedProvider(provider);

    const connected = await connectWallet(config);

    expect(connected.address).toBe("0x1111111111111111111111111111111111111111");
    expect(methods).toEqual(["eth_requestAccounts", "eth_chainId"]);
    expect(methods).not.toContain("wallet_requestSnaps");
  });

  it("adds Bradbury when the wallet does not know the chain, then switches to it", async () => {
    const calls: Array<{ method: string; params?: unknown[] }> = [];
    let switchAttempts = 0;
    const provider: WalletProvider = {
      request: vi.fn(async (request) => {
        calls.push(request);
        if (request.method === "eth_requestAccounts") return ["0x1111111111111111111111111111111111111111"];
        if (request.method === "eth_chainId") return "0x1";
        if (request.method === "wallet_switchEthereumChain") {
          switchAttempts += 1;
          if (switchAttempts === 1) throw { code: 4902, message: "Unknown chain" };
          return null;
        }
        if (request.method === "wallet_addEthereumChain") return null;
        throw new Error(`Unexpected wallet method: ${request.method}`);
      })
    };
    setInjectedProvider(provider);

    await connectWallet(config);

    expect(calls.map((call) => call.method)).toEqual([
      "eth_requestAccounts",
      "eth_chainId",
      "wallet_switchEthereumChain",
      "wallet_addEthereumChain",
      "wallet_switchEthereumChain"
    ]);
    expect(calls[3].params).toEqual([expect.objectContaining({ chainId: "0x107d", chainName: "Genlayer Bradbury Testnet" })]);
  });

  it("turns common wallet errors into actionable messages", () => {
    expect(normalizeError({ code: 4001 })).toMatch(/rejected/i);
    expect(normalizeError({ cause: { code: -32002 } })).toMatch(/already pending/i);
  });
});
