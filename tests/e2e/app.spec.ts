import { expect, test } from "@playwright/test";

async function requireBradburyData(page: import("@playwright/test").Page) {
  await expect(page.getByText("Loading Bradbury contract views...")).toHaveCount(0, { timeout: 25_000 });
  const error = page.getByText("Could not read Bradbury contract state");
  if (await error.isVisible().catch(() => false)) {
    test.skip(true, "Bradbury RPC did not return contract views during this run.");
  }
}

test("renders canonical Bradbury dashboard without demo payment rows", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Public on-chain agreement dashboard" })).toBeVisible();
  await expect(page.getByText("Implement a grant dashboard MVP")).toHaveCount(0);
  await requireBradburyData(page);
  await expect(page.getByRole("button", { name: /ClauseFlow verified payment flow/ })).toContainText("PAID");
  await expect(page.getByText("Could not read Bradbury contract state")).toHaveCount(0);
});

test("filters a contract by both parties and opens the full timeline", async ({ page }) => {
  await page.goto("/");
  await requireBradburyData(page);
  await expect(page.getByText("ClauseFlow verified payment flow")).toBeVisible();
  await page.getByLabel("Builder address filter").fill("0xe78def025cE53c9b46ac56cF19f720391119fa5b");
  await page.getByLabel("Client address filter").fill("0x1C6912d89399820D0f1f932eb2aDB91E293EC512");
  await page.getByRole("button", { name: /ClauseFlow verified payment flow/ }).click();
  await expect(page.getByRole("heading", { name: "ClauseFlow verified payment flow" })).toBeVisible();
  await expect(page.getByText("GEN payment verified from escrow balance.")).toBeVisible();
  await expect(page.getByText("Payment transfer emitted and awaiting finalization.")).toBeVisible();
});

test("requires contract structuring before an offer can be published", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /^Create$/ }).click();
  await expect(page.getByRole("button", { name: "Publish Reviewed Offer" })).toBeDisabled();
  await expect(page.getByText("Not structured")).toBeVisible();
});

test("mobile layout has no horizontal overflow", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Public on-chain agreement dashboard" })).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  expect(overflow).toBe(false);
});
