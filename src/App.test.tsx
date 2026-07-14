import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";
import * as genlayer from "./lib/genlayer";

vi.mock("./lib/genlayer", async () => {
  const actual = await vi.importActual<typeof import("./lib/genlayer")>("./lib/genlayer");
  return {
    ...actual,
    createReadClient: vi.fn(() => ({})),
    connectWallet: vi.fn(async () => ({ client: {}, address: builder })),
    writeAndVerify: vi.fn(async (_config, _functionName, _args, _value, onSubmitted) => {
      onSubmitted?.("0xabc");
      return { hash: "0xabc", address: builder, lifecycle: "ACCEPTED", executionResult: "FINISHED_WITH_RETURN", consensusResult: "AGREE", childTransactions: [] };
    }),
    readJsonView: vi.fn()
  };
});

const builder = "0x1111111111111111111111111111111111111111";
const client = "0x2222222222222222222222222222222222222222";
const clauses = {
  scope: "Deliver a public verified page.",
  deliverables: "Accessible HTTPS page.",
  acceptanceCriteria: "Page returns content and shows Example Domain.",
  deadline: "1 day after funding plus a 24 hour grace period.",
  revisionRules: "Maximum 1 revision round within 24 hours.",
  paymentTerms: "Release exactly 20000000000000000 attoGEN after approval.",
  refundConditions: "Refund after deadline and grace period.",
  summary: "Verified public page agreement."
};
const offer = {
  id: "1", title: "Verified public page", builder, priceAttoGen: "20000000000000000", deadlineDays: "1", revisionRounds: "1",
  scope: clauses.scope, deliverables: clauses.deliverables, acceptanceCriteria: clauses.acceptanceCriteria, refundRule: clauses.refundConditions,
  referenceUrls: "https://example.com", structuredClauses: JSON.stringify(clauses), status: "OFFER_PUBLISHED"
};
const deal = {
  id: "1", offerId: "1", title: offer.title, builder, client, lockedAttoGen: offer.priceAttoGen, status: "PAID",
  fundedAt: "2026-07-12T04:22:40Z", submittedAt: "2026-07-12T04:22:52Z", reviewedAt: "2026-07-12T04:23:43Z", completedAt: "2026-07-12T04:25:57Z",
  paidAt: "2026-07-12T04:25:57Z", refundedAt: "", deadlineAtUnix: "1783916560", refundAvailableAtUnix: "1784002960",
  deliveryUrl: "https://example.com", githubUrl: "", demoUrl: "https://example.com", documentationUrl: "https://www.iana.org/help/example-domains",
  deliveryNote: "Delivered", reviewResult: "APPROVED", reviewScore: "100", reviewReason: "Evidence verified", revisionChecklist: "",
  nextAction: "Completed", paymentTxType: "EXTERNAL_GEN_TRANSFER_TO_BUILDER", paid: "true", refunded: "false"
};
const stats = { totalOffers: "1", totalDeals: "1", activeDeals: "0", completedDeals: "1", totalFundedAtto: offer.priceAttoGen, totalPaidAtto: offer.priceAttoGen, totalRefundedAtto: "0", contractBalanceAtto: "0", accountedEscrowAtto: "0" };

describe("ClauseFlow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.CLAUSEFLOW_CONFIG = { contractAddress: "0x3333333333333333333333333333333333333333", chain: "testnetBradbury", explorerUrl: "https://explorer-bradbury.genlayer.com" };
    vi.mocked(genlayer.readJsonView).mockImplementation(async (_client, _config, functionName) => {
      if (functionName === "get_offer_ids") return ["1"];
      if (functionName === "get_deal_ids") return ["1"];
      if (functionName === "get_dashboard_stats") return stats;
      if (functionName === "get_offer") return offer;
      if (functionName === "get_deal") return deal;
      if (functionName === "get_deal_history") return [{ eventType: "PAID", note: "GEN payment verified", timestamp: deal.paidAt, actor: builder }];
      if (functionName === "get_structured_offer") return { ...offer, serviceDescription: "Verified page", priceAttoGen: offer.priceAttoGen, revisionWindowHours: "24", gracePeriodHours: "24", clauses, structuredAt: deal.fundedAt, publishedOfferId: "" };
      throw new Error(`Unexpected view ${functionName}`);
    });
  });

  it("loads canonical on-chain dashboard data without seeded payment rows", async () => {
    render(<App />);
    expect(screen.queryByText(/Implement a grant dashboard MVP/i)).toBeNull();
    expect(await screen.findByText(/Verified public page/i)).toBeTruthy();
    expect(screen.getByText("0.02")).toBeTruthy();
    expect(screen.getByText("PAID")).toBeTruthy();
  });

  it("filters history by both party addresses", async () => {
    render(<App />);
    await screen.findByText(/Verified public page/i);
    fireEvent.change(screen.getByLabelText("Builder address filter"), { target: { value: "0x999" } });
    expect(screen.getByText(/No on-chain agreements yet/i)).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Builder address filter"), { target: { value: builder } });
    fireEvent.change(screen.getByLabelText("Client address filter"), { target: { value: client } });
    expect(screen.getByText(/Verified public page/i)).toBeTruthy();
  });

  it("keeps publishing locked until a contract draft is read from chain", async () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: /^Create$/i }));
    const publish = screen.getByRole("button", { name: /Publish Reviewed Offer/i });
    expect((publish as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: /Structure Clauses/i }));
    await waitFor(() => expect(screen.getByText("Stored on-chain")).toBeTruthy());
    expect((publish as HTMLButtonElement).disabled).toBe(false);
    expect(screen.getByText(clauses.paymentTerms)).toBeTruthy();
  });

  it("shows execution failures instead of reporting accepted as success", async () => {
    vi.mocked(genlayer.writeAndVerify).mockRejectedValueOnce(new Error("FINISHED_WITH_ERROR: contract execution did not succeed."));
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: /^Create$/i }));
    fireEvent.click(screen.getByRole("button", { name: /Structure Clauses/i }));
    expect(await screen.findByText(/FINISHED_WITH_ERROR/i)).toBeTruthy();
  });
});

declare global {
  interface Window {
    CLAUSEFLOW_CONFIG?: genlayer.ClauseFlowConfig;
  }
}
