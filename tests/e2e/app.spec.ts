import { expect, test } from "@playwright/test";

async function openLocalPreview(page: import("@playwright/test").Page) {
  await page.route("**/config.js", async (route) => {
    await route.fulfill({
      contentType: "application/javascript",
      body: `window.CLAUSEFLOW_CONFIG = {
        contractAddress: "",
        chain: "testnetBradbury",
        explorerUrl: "https://explorer-bradbury.genlayer.com",
        stateStatus: "accepted"
      };`
    });
  });
  await page.goto("/");
}

async function openCreateView(page: import("@playwright/test").Page) {
  if ((page.viewportSize()?.width || 1280) <= 840) {
    await page.getByRole("button", { name: "Open navigation" }).click();
  }
  await page.getByRole("button", { name: /^Create$/ }).click();
}

test("renders dashboard shell without blank screen or fake success", async ({ page }) => {
  await openLocalPreview(page);
  await expect(page.getByRole("heading", { name: "Public on-chain agreement dashboard" })).toBeVisible();
  await expect(page.getByText("No verified Bradbury contract address is configured")).toBeVisible();
  await expect(page.getByRole("region", { name: "Protocol summary" }).getByText("0", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Protocol summary" }).getByText("Unavailable", { exact: true })).toHaveCount(5);
  await expect(page.getByText("[object Object]")).toHaveCount(0);
});

test("renders the exact-contract snapshot immediately with full on-chain validator fields", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("ClauseFlow release evidence dossier", { exact: true })).toBeVisible();
  await expect(page.getByRole("status")).toContainText(/Verified on-chain snapshot|Live on-chain data/);
  await page.locator("button.ledgerRow").filter({ hasText: "ClauseFlow release evidence dossier" }).click();
  await page.getByRole("tab", { name: "Evidence & review", exact: true }).click();
  await expect(page.getByText("Full validator report", { exact: true })).toBeVisible();
  await expect(page.getByText("Acceptance criteria", { exact: true })).toBeVisible();
  await expect(page.getByText("Validator reasoning", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("On-chain verification rule", { exact: true })).toBeVisible();
});

test("create form starts empty without a seeded demo agreement", async ({ page }) => {
  await openLocalPreview(page);
  await openCreateView(page);
  await expect(page.getByRole("button", { name: "Publish Reviewed Offer" })).toBeDisabled();
  await expect(page.getByLabel("Offer title")).toHaveValue("");
  const values = await page.locator("input, textarea").evaluateAll((nodes) => nodes.map((node) => (node as HTMLInputElement | HTMLTextAreaElement).value).join("\n"));
  expect(values).not.toContain("Example Domain");

  await expect(page.getByRole("button", { name: /Load real example/i })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Structure clauses" })).toBeDisabled();
});

test("lets the user select OKX when multiple wallets are installed", async ({ page }) => {
  await page.addInitScript(() => {
    const calls: string[] = [];
    const okxProvider = {
      isOkxWallet: true,
      request: async ({ method }: { method: string }) => {
        calls.push(`okx:${method}`);
        if (method === "eth_requestAccounts") return ["0x2222222222222222222222222222222222222222"];
        if (method === "eth_chainId") return "0x107d";
        throw new Error(`Unexpected wallet method: ${method}`);
      }
    };
    const metamaskProvider = {
      isMetaMask: true,
      request: async ({ method }: { method: string }) => {
        calls.push(`metamask:${method}`);
        if (method === "eth_requestAccounts") return ["0x1111111111111111111111111111111111111111"];
        if (method === "eth_chainId") return "0x1";
        if (method === "wallet_switchEthereumChain") return null;
        throw new Error(`Unexpected wallet method: ${method}`);
      }
    };
    Object.defineProperty(window, "ethereum", {
      configurable: true,
      value: { request: okxProvider.request, providers: [okxProvider, metamaskProvider] }
    });
    window.addEventListener("eip6963:requestProvider", () => {
      window.dispatchEvent(new CustomEvent("eip6963:announceProvider", { detail: { info: { uuid: "okx", name: "OKX Wallet", rdns: "com.okex.wallet" }, provider: okxProvider } }));
      window.dispatchEvent(new CustomEvent("eip6963:announceProvider", { detail: { info: { uuid: "metamask", name: "MetaMask", rdns: "io.metamask" }, provider: metamaskProvider } }));
    });
    Object.defineProperty(window, "__walletCalls", { configurable: true, value: calls });
  });
  await openLocalPreview(page);

  await page.getByRole("button", { name: "Connect wallet" }).click();
  await expect(page.getByRole("dialog", { name: "Connect a wallet" })).toBeVisible();
  await page.getByRole("button", { name: /OKX Wallet/i }).click();

  await expect(page.getByRole("button", { name: /0x2222\.\.\.2222/i })).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { __walletCalls: string[] }).__walletCalls)).toEqual([
    "okx:eth_requestAccounts",
    "okx:eth_chainId"
  ]);
});

test("mobile layout has no horizontal overflow", async ({ page }) => {
  await openLocalPreview(page);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  expect(overflow).toBe(false);
});
