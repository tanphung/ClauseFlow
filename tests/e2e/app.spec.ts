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

test("mobile layout has no horizontal overflow", async ({ page }) => {
  await openLocalPreview(page);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  expect(overflow).toBe(false);
});
