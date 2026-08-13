import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { createClient } from "genlayer-js";
import { testnetBradbury } from "genlayer-js/chains";

const contractAddress = "0xF85C4460B8195F9ebFD7b376c852aD7E89Ffe63D";
const outputPath = resolve("src/data/onchain-snapshot.json");
const client = createClient({ chain: testnetBradbury });

async function readJson(functionName, args = []) {
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const value = await client.readContract({
        address: contractAddress,
        functionName,
        args,
        transactionHashVariant: "latest-nonfinal"
      });
      return typeof value === "string" ? JSON.parse(value) : value;
    } catch (error) {
      lastError = error;
      if (attempt < 3) await new Promise((resolveDelay) => setTimeout(resolveDelay, 2_000 * attempt));
    }
  }
  throw lastError;
}

const [offerIds, dealIds, stats] = await Promise.all([
  readJson("get_offer_ids"),
  readJson("get_deal_ids"),
  readJson("get_dashboard_stats")
]);
const [offers, deals, historyEntries] = await Promise.all([
  Promise.all(offerIds.map((id) => readJson("get_offer", [id]))),
  Promise.all(dealIds.map((id) => readJson("get_deal", [id]))),
  Promise.all(dealIds.map(async (id) => [id, await readJson("get_deal_history", [id])]))
]);

const expected = {
  totalOffers: "2",
  totalDeals: "2",
  completedDeals: "2",
  totalFundedAtto: "35000000000000000",
  totalPaidAtto: "20000000000000000",
  totalRefundedAtto: "15000000000000000",
  contractBalanceAtto: "0",
  accountedEscrowAtto: "0"
};
for (const [key, value] of Object.entries(expected)) {
  if (String(stats[key]) !== value) throw new Error(`Snapshot gate failed: ${key}=${stats[key]}, expected ${value}`);
}
if (offers.length !== 2 || deals.length !== 2 || deals.some((deal) => !["PAID", "REFUNDED"].includes(deal.status))) {
  throw new Error("Snapshot gate failed: expected exactly two terminal pilot agreements.");
}

const snapshot = {
  version: 1,
  network: "testnetBradbury",
  contractAddress,
  generatedAt: new Date().toISOString(),
  stats,
  offers,
  deals,
  histories: Object.fromEntries(historyEntries)
};
mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
console.log(`SNAPSHOT_OK contract=${contractAddress} offers=${offers.length} deals=${deals.length} output=${outputPath}`);
