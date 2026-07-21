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
  scope: "Audit and polish the Mochi-Game Quest Evaluator reviewer path.",
  deliverables: "Live app URL, GitHub repository, README evidence, and delivery note.",
  acceptanceCriteria: "Validators can fetch Mochi-Game live app and README evidence.",
  milestones: "Evidence inventory\nReviewer path polish",
  evidenceRequirements: "Live app URL\nGitHub repository URL\nREADME URL",
  verificationPlan: "Fetch live app\nFetch GitHub README\nCompare evidence with accepted criteria",
  deadline: "3 days after funding plus a 24 hour grace period.",
  revisionRules: "Maximum 1 revision round within 24 hours.",
  paymentTerms: "Release 0.02 GEN after approval.",
  refundConditions: "Refund after deadline and grace period.",
  summary: "Mochi-Game Quest Evaluator evidence agreement.",
  priceDisplay: "0.02"
};
const offer = {
  id: "1", title: "Mochi-Game Quest Evaluator polish", builder, priceAttoGen: "20000000000000000", deadlineDays: "3", revisionRounds: "1",
  scope: clauses.scope, deliverables: clauses.deliverables, acceptanceCriteria: clauses.acceptanceCriteria, refundRule: clauses.refundConditions,
  referenceUrls: "https://github.com/tanphung/Mochi-Game\nhttps://mochi-game-frontend.vercel.app", structuredClauses: JSON.stringify(clauses), status: "OFFER_PUBLISHED"
};
const deal = {
  id: "1", offerId: "1", title: offer.title, builder, client, lockedAttoGen: offer.priceAttoGen, status: "PAID",
  fundedAt: "2026-07-12T04:22:40Z", submittedAt: "2026-07-12T04:22:52Z", reviewedAt: "2026-07-12T04:23:43Z", completedAt: "2026-07-12T04:25:57Z",
  paidAt: "2026-07-12T04:25:57Z", refundedAt: "", deadlineAtUnix: "1783916560", refundAvailableAtUnix: "1784002960",
  deliveryUrl: "https://mochi-game-frontend.vercel.app", githubUrl: "https://github.com/tanphung/Mochi-Game", demoUrl: "https://mochi-game-frontend.vercel.app", documentationUrl: "https://github.com/tanphung/Mochi-Game#readme",
  deliveryNote: "Delivered Mochi-Game evidence", reviewResult: "APPROVED", reviewScore: "100", reviewReason: "Evidence verified", revisionChecklist: "",
  reviewEvidenceSummary: "Fetched live app and README.",
  reviewCriteriaResults: "Live app: PASS\nGitHub README: PASS",
  reviewMissingItems: "",
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
      if (functionName === "get_deal_history") return [
        { eventType: "REVIEWED", note: "{legacy-review-payload}", timestamp: deal.reviewedAt, actor: client },
        { eventType: "PAID", note: "GEN payment verified", timestamp: deal.paidAt, actor: builder }
      ];
      if (functionName === "get_structured_offer") return { ...offer, serviceDescription: "Verified page", priceAttoGen: offer.priceAttoGen, revisionWindowHours: "24", gracePeriodHours: "24", clauses, structuredAt: deal.fundedAt, publishedOfferId: "" };
      throw new Error(`Unexpected view ${functionName}`);
    });
  });

  it("loads canonical on-chain dashboard data without seeded payment rows", async () => {
    render(<App />);
    expect(screen.queryByText(/Implement a grant dashboard MVP/i)).toBeNull();
    expect(await screen.findByText(/Mochi-Game Quest Evaluator polish/i)).toBeTruthy();
    expect(screen.getAllByText("0.02").length).toBeGreaterThan(0);
    expect(screen.getByText("PAID")).toBeTruthy();
    expect(screen.queryByText(/Example Domain/i)).toBeNull();
    expect(screen.queryByText(/attoGEN/i)).toBeNull();
  });

  it("filters history by both party addresses", async () => {
    render(<App />);
    await screen.findByText(/Mochi-Game Quest Evaluator polish/i);
    fireEvent.change(screen.getByLabelText("Builder address filter"), { target: { value: "0x999" } });
    expect(screen.getByText(/No matching agreements/i)).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Builder address filter"), { target: { value: builder } });
    fireEvent.change(screen.getByLabelText("Client address filter"), { target: { value: client } });
    expect(screen.getByText(/Mochi-Game Quest Evaluator polish/i)).toBeTruthy();
  });

  it("keeps publishing locked until a contract draft is read from chain", async () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: /^Create$/i }));
    const publish = screen.getByRole("button", { name: /Publish Reviewed Offer/i });
    expect((publish as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByDisplayValue(/Example Domain/i)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Load real example/i }));
    expect((screen.getByLabelText("Revision window hours") as HTMLInputElement).value).toBe("24");
    fireEvent.click(screen.getByRole("button", { name: /Structure Clauses/i }));
    await waitFor(() => expect(screen.getByText("Stored on-chain")).toBeTruthy());
    expect((publish as HTMLButtonElement).disabled).toBe(false);
    expect(screen.getByText(clauses.paymentTerms)).toBeTruthy();
  });

  it("normalizes execution failures instead of rendering object errors", async () => {
    vi.mocked(genlayer.writeAndVerify).mockRejectedValueOnce({ shortMessage: "FINISHED_WITH_ERROR: contract execution did not succeed." });
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: /^Create$/i }));
    fireEvent.click(screen.getByRole("button", { name: /Load real example/i }));
    fireEvent.click(screen.getByRole("button", { name: /Structure Clauses/i }));
    expect(await screen.findByText(/FINISHED_WITH_ERROR/i)).toBeTruthy();
    expect(screen.queryByText(/\[object Object\]/i)).toBeNull();
  });

  it("renders reviewed history as readable evidence instead of raw payloads", async () => {
    render(<App />);
    await screen.findByText(/Mochi-Game Quest Evaluator polish/i);
    fireEvent.click(screen.getByRole("button", { name: /Deal Detail/i }));
    fireEvent.click(screen.getByRole("tab", { name: /On-chain history/i }));
    expect(screen.getByText(/Approved \(100\/100\)\. Fetched live app and README\./i)).toBeTruthy();
    expect(screen.queryByText(/\{legacy-review-payload\}/i)).toBeNull();
  });

  it("opens accepted agreement terms by default in deal detail", async () => {
    render(<App />);
    await screen.findByText(/Mochi-Game Quest Evaluator polish/i);
    fireEvent.click(screen.getByRole("button", { name: /Deal Detail/i }));
    const summary = screen.getByText("Full accepted terms");
    expect((summary.closest("details") as HTMLDetailsElement).open).toBe(true);
  });
});

declare global {
  interface Window {
    CLAUSEFLOW_CONFIG?: genlayer.ClauseFlowConfig;
  }
}
