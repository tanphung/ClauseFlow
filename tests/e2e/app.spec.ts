import { expect, test, type Page } from "@playwright/test";

const contract = "0x3333333333333333333333333333333333333333";
const router = "0x4444444444444444444444444444444444444444";
const builder = "0x1111111111111111111111111111111111111111";
const client = "0x2222222222222222222222222222222222222222";
const obligations = [
  { id: "O_METHODS", category: "DELIVERABLE", statement: "Publish the immutable release method dossier.", acceptanceRule: "The pinned dossier maps all v2 methods to public source.", requiredEvidenceTypes: ["DOCUMENTATION", "SOURCE"] },
  { id: "O_RECEIPT", category: "ACCEPTANCE", statement: "Bind payment to the exact deal-specific router receipt.", acceptanceRule: "The receipt matches deal, recipient, amount, kind, source, and released state.", requiredEvidenceTypes: ["SOURCE"] }
];
const manifest = [{ id: "E_CONTRACT", type: "SOURCE", label: "Pinned contract source", url: "https://raw.githubusercontent.com/tanphung/ClauseFlow/abcdef1234567890abcdef1234567890abcdef12/contracts/clauseflow.py", versionKind: "GIT_COMMIT", versionId: "abcdef1234567890abcdef1234567890abcdef12", sha256: "a".repeat(64) }];
const offer = { id: "1", protocolVersion: "CLAUSEFLOW_V2", title: "ClauseFlow v2 immutable enforcement dossier", serviceDescription: "A version-bound release dossier.", builder, priceAttoGen: "20000000000000000", status: "OFFER_PUBLISHED", obligations: JSON.stringify(obligations), obligationsHash: "0xterms", deliveryWindowHours: "48", gracePeriodHours: "24", revisionRounds: "1", revisionWindowHours: "24", reviewWindowHours: "24" };
const deal = {
  id: "1", offerId: "1", protocolVersion: "CLAUSEFLOW_V2", title: offer.title, serviceDescription: offer.serviceDescription, builder, client, lockedAttoGen: offer.priceAttoGen, status: "PAID",
  obligations: offer.obligations, obligationsHash: offer.obligationsHash, deliveryWindowHours: "48", gracePeriodHours: "24", maxRevisions: "1", revisionWindowHours: "24", reviewWindowHours: "24", revisionCount: "0", submissionRound: "1",
  fundedAt: "2026-08-20T08:00:00Z", submittedAt: "2026-08-20T08:10:00Z", reviewedAt: "2026-08-20T08:20:00Z", completedAt: "2026-08-20T08:30:00Z", paidAt: "2026-08-20T08:30:00Z", refundedAt: "",
  currentEvidenceManifest: JSON.stringify(manifest), currentEvidenceHash: "0xmanifest", currentDeliveryNote: "Pinned evidence addresses every accepted obligation.", reviewResult: "APPROVED", reviewScore: "100",
  reviewExecutiveSummary: "Every accepted obligation was adjudicated against immutable public evidence.",
  reviewObligationAssessments: JSON.stringify(obligations.map((item) => ({ obligationId: item.id, category: item.category, statement: item.statement, status: "SATISFIED", finding: `The pinned source satisfies ${item.id}.`, reasoning: `Validators independently refetched the immutable source and verified the acceptance rule for ${item.id}.`, evidenceIds: ["E_CONTRACT"] }))),
  reviewSourceAssessments: JSON.stringify([{ ...manifest[0], accessible: true, versionMatched: true, expectedSha256: "a".repeat(64), actualSha256: "a".repeat(64) }]), reviewStrengths: "[\"Every obligation has direct immutable evidence.\"]", reviewRisks: "[]", reviewMissingItems: "[]", reviewRevisionChecklist: "[]",
  reviewConsensusBasis: "Protocol-selected validators independently refetched every immutable source and verified the exact obligation IDs and settlement decision.", settlementId: "CF2|contract|1|1|1|builder|20000000000000000", settlementKind: "1", settlementRecipient: builder, settlementAmountAtto: offer.priceAttoGen, settlementConfirmedAt: "2026-08-20T08:30:00Z", paid: "true", refunded: "false", nextAction: "Settlement confirmed"
};
const stats = { protocolVersion: "CLAUSEFLOW_V2", totalOffers: "1", totalDeals: "1", activeDeals: "0", completedDeals: "1", pendingSettlements: "0", totalFundedAtto: offer.priceAttoGen, totalPaidAtto: offer.priceAttoGen, totalRefundedAtto: "0", contractBalanceAtto: "0", accountedEscrowAtto: "0", settlementRouter: router };

async function openV2(page: Page) {
  await page.route("**/config.js", async (route) => route.fulfill({
    contentType: "application/javascript",
    body: `window.CLAUSEFLOW_CONFIG={contractAddress:"${contract}",settlementRouter:"${router}",protocolVersion:"v2",chain:"testnetBradbury",explorerUrl:"https://explorer-bradbury.genlayer.com",stateStatus:"accepted"};`
  }));
  await page.addInitScript(({ key, value }) => localStorage.setItem(key, value), {
    key: `clauseflow:dashboard:${contract}`,
    value: JSON.stringify({ version: 2, network: "testnetBradbury", contractAddress: contract, offers: [offer], deals: [deal], stats, histories: { "1": [{ eventType: "PAID", note: "Exact router receipt confirmed", timestamp: deal.paidAt, actor: builder }] }, generatedAt: "2026-08-20T08:30:00Z" })
  });
  await page.goto("/");
}

async function openWorkspaceView(page: Page, name: string | RegExp) {
  if ((page.viewportSize()?.width || 1440) <= 840) await page.getByRole("button", { name: "Open navigation" }).click();
  await page.getByRole("button", { name }).click();
}

test("renders the verified v2 snapshot immediately without fake success", async ({ page }) => {
  await openV2(page);
  await expect(page.getByRole("heading", { name: "Public on-chain agreement dashboard" })).toBeVisible();
  await expect(page.getByText(offer.title, { exact: true })).toBeVisible();
  await expect(page.getByText(/Verified on-chain snapshot|Live on-chain data synced/)).toBeVisible();
  await expect(page.getByText("[object Object]")).toHaveCount(0);
  await expect(page.getByText("attoGEN")).toHaveCount(0);
});

test("shows every accepted obligation open by default", async ({ page }) => {
  await openV2(page);
  await openWorkspaceView(page, "Deal detail");
  await expect(page.getByText("Every binding obligation")).toBeVisible();
  await expect(page.getByText(obligations[0].statement)).toBeVisible();
  await expect(page.getByText(obligations[1].acceptanceRule)).toBeVisible();
  await expect(page.getByText("1/1 used")).toHaveCount(0);
});

test("renders only stored validator reasoning and immutable source proof", async ({ page }) => {
  await openV2(page);
  await openWorkspaceView(page, "Deal detail");
  await page.getByRole("button", { name: /Evidence & review/i }).click();
  await expect(page.getByText("Full validator report", { exact: true })).toBeVisible();
  await expect(page.getByText(/Every accepted obligation was adjudicated/i)).toBeVisible();
  await expect(page.getByText(/independently refetched the immutable source/i).first()).toBeVisible();
  await expect(page.getByText("SATISFIED")).toHaveCount(2);
  await expect(page.getByText(/GIT_COMMIT abcdef123456/i)).toBeVisible();
});

test("filters the canonical deal ledger by both parties", async ({ page }) => {
  await openV2(page);
  await page.getByPlaceholder("0x...").first().fill("0x999");
  await expect(page.getByText("No agreements on this contract")).toBeVisible();
  await page.getByPlaceholder("0x...").first().fill(builder);
  await page.getByPlaceholder("0x...").nth(1).fill(client);
  await expect(page.getByText(offer.title, { exact: true })).toBeVisible();
});

test("keeps the Builder workspace empty and requires a binding manifest", async ({ page }) => {
  await openV2(page);
  await openWorkspaceView(page, "New offer");
  await expect(page.getByLabel("Offer title")).toHaveValue("");
  await expect(page.getByRole("button", { name: /Publish reviewed offer/i })).toBeDisabled();
  await expect(page.getByText(/Every binding promise belongs in the obligation manifest/i)).toBeVisible();
  const values = await page.locator("input, textarea").evaluateAll((nodes) => nodes.map((node) => (node as HTMLInputElement | HTMLTextAreaElement).value).join("\n"));
  expect(values).not.toContain("Example Domain");
});

test("lets the user explicitly choose OKX through EIP-6963", async ({ page }) => {
  await page.addInitScript(() => {
    const calls: string[] = [];
    const okx = { isOkxWallet: true, request: async ({ method }: { method: string }) => { calls.push(`okx:${method}`); if (method === "eth_requestAccounts") return ["0x2222222222222222222222222222222222222222"]; if (method === "eth_chainId") return "0x107d"; throw new Error(method); } };
    const metamask = { isMetaMask: true, request: async ({ method }: { method: string }) => { calls.push(`metamask:${method}`); if (method === "eth_requestAccounts") return ["0x1111111111111111111111111111111111111111"]; if (method === "eth_chainId") return "0x107d"; throw new Error(method); } };
    Object.defineProperty(window, "ethereum", { configurable: true, value: { providers: [okx, metamask], request: okx.request } });
    window.addEventListener("eip6963:requestProvider", () => {
      window.dispatchEvent(new CustomEvent("eip6963:announceProvider", { detail: { info: { uuid: "okx", name: "OKX Wallet", rdns: "com.okex.wallet" }, provider: okx } }));
      window.dispatchEvent(new CustomEvent("eip6963:announceProvider", { detail: { info: { uuid: "metamask", name: "MetaMask", rdns: "io.metamask" }, provider: metamask } }));
    });
    Object.defineProperty(window, "__walletCalls", { configurable: true, value: calls });
  });
  await openV2(page);
  await page.getByRole("button", { name: "Connect wallet" }).click();
  await expect(page.getByRole("dialog", { name: "Choose wallet" })).toBeVisible();
  await page.getByRole("button", { name: /OKX Wallet/i }).click();
  await expect(page.getByRole("button", { name: "0x22222...22222", exact: true })).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { __walletCalls: string[] }).__walletCalls)).toEqual(["okx:eth_requestAccounts", "okx:eth_chainId"]);
});

test("has no incoherent horizontal overflow", async ({ page }) => {
  await openV2(page);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  expect(overflow).toBe(false);
});
