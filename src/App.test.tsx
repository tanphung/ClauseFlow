import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";
import * as genlayer from "./lib/genlayer";

const builder = "0x1111111111111111111111111111111111111111";
const client = "0x2222222222222222222222222222222222222222";
const contract = "0x3333333333333333333333333333333333333333";
const router = "0x4444444444444444444444444444444444444444";
const runtimeWindow = () => window as unknown as { CLAUSEFLOW_CONFIG?: genlayer.ClauseFlowConfig };
const obligations = [
  { id: "O_DELIVERY", category: "DELIVERABLE", statement: "Publish the immutable release dossier.", acceptanceRule: "The dossier maps every named method to public evidence.", requiredEvidenceTypes: ["DOCUMENTATION", "SOURCE"] },
  { id: "O_RUNTIME", category: "ACCEPTANCE", statement: "Expose the complete agreement workflow in the live app.", acceptanceRule: "The deployed interface exposes each accepted lifecycle action.", requiredEvidenceTypes: ["DELIVERY"] }
];
const manifest = [
  { id: "E_DOC", type: "DOCUMENTATION", label: "Release dossier", url: "https://raw.githubusercontent.com/tanphung/ClauseFlow/abcdef123456/docs/RELEASE_EVIDENCE.md", versionKind: "GIT_COMMIT", versionId: "abcdef123456", sha256: "a".repeat(64) },
  { id: "E_APP", type: "DELIVERY", label: "Pinned deployment", url: "https://clauseflow-two-git-abcdef123456.vercel.app", versionKind: "VERCEL_DEPLOYMENT", versionId: "abcdef123456", sha256: "b".repeat(64) }
];
const offer = {
  id: "1", protocolVersion: "CLAUSEFLOW_V2", title: "ClauseFlow immutable release agreement", serviceDescription: "Verify a version-bound release package.", builder,
  priceAttoGen: "20000000000000000", status: "OFFER_PUBLISHED", obligations: JSON.stringify(obligations), obligationsHash: "0xterms",
  deliveryWindowHours: "48", gracePeriodHours: "24", revisionRounds: "1", revisionWindowHours: "24", reviewWindowHours: "24"
};
const deal = {
  id: "1", offerId: "1", protocolVersion: "CLAUSEFLOW_V2", title: offer.title, serviceDescription: offer.serviceDescription, builder, client,
  lockedAttoGen: offer.priceAttoGen, status: "PAID", obligations: offer.obligations, obligationsHash: offer.obligationsHash,
  deliveryWindowHours: "48", gracePeriodHours: "24", maxRevisions: "1", revisionWindowHours: "24", reviewWindowHours: "24", revisionCount: "0", submissionRound: "1",
  fundedAt: "2026-08-20T08:00:00Z", submittedAt: "2026-08-20T08:10:00Z", reviewedAt: "2026-08-20T08:20:00Z", completedAt: "2026-08-20T08:30:00Z", paidAt: "2026-08-20T08:30:00Z", refundedAt: "",
  currentEvidenceManifest: JSON.stringify(manifest), currentEvidenceHash: "0xmanifest", currentDeliveryNote: "The pinned evidence satisfies both obligations.",
  reviewResult: "APPROVED", reviewScore: "100", reviewExecutiveSummary: "Every accepted obligation was adjudicated against immutable public evidence.",
  reviewObligationAssessments: JSON.stringify([
    { obligationId: "O_DELIVERY", category: "DELIVERABLE", statement: obligations[0].statement, status: "SATISFIED", finding: "The dossier contains the required method matrix.", reasoning: "Validators independently fetched the pinned dossier and verified the matrix.", evidenceIds: ["E_DOC"] },
    { obligationId: "O_RUNTIME", category: "ACCEPTANCE", statement: obligations[1].statement, status: "SATISFIED", finding: "The pinned app exposes the required lifecycle.", reasoning: "Validators fetched the immutable deployment and checked the accepted actions.", evidenceIds: ["E_APP"] }
  ]),
  reviewSourceAssessments: JSON.stringify(manifest.map((source) => ({ ...source, accessible: true, versionMatched: true, expectedSha256: source.sha256, actualSha256: source.sha256 }))),
  reviewStrengths: JSON.stringify(["All accepted obligations have direct evidence."]), reviewRisks: "[]", reviewMissingItems: "[]", reviewRevisionChecklist: "[]",
  reviewConsensusBasis: "Protocol-selected validators independently refetched every immutable source and verified exact obligation IDs.",
  settlementId: "CLAUSEFLOW:1:PAYMENT:1", settlementKind: "PAYMENT", settlementRecipient: builder, settlementAmountAtto: offer.priceAttoGen, settlementConfirmedAt: "2026-08-20T08:30:00Z",
  paid: "true", refunded: "false", nextAction: "Settlement confirmed"
};
const stats = { protocolVersion: "CLAUSEFLOW_V2", totalOffers: "1", totalDeals: "1", activeDeals: "0", completedDeals: "1", pendingSettlements: "0", totalFundedAtto: offer.priceAttoGen, totalPaidAtto: offer.priceAttoGen, totalRefundedAtto: "0", contractBalanceAtto: "0", accountedEscrowAtto: "0", settlementRouter: router };
const history = [
  { eventType: "FUNDED", note: "Exact accepted terms funded", timestamp: deal.fundedAt, actor: client },
  { eventType: "PAID", note: "Exact router receipt confirmed", timestamp: deal.paidAt, actor: builder }
];
const rounds = [{ round: "1", submittedAt: deal.submittedAt, manifest, manifestHash: deal.currentEvidenceHash, deliveryNote: deal.currentDeliveryNote }];
const snapshot = (overrides: Record<string, unknown> = {}) => ({
  version: 2,
  network: "testnetBradbury",
  contractAddress: contract,
  protocolVersion: "v2",
  settlementRouter: router,
  offers: [offer],
  deals: [deal],
  stats,
  histories: { "1": history },
  generatedAt: "2026-08-20T08:30:00Z",
  ...overrides
});

vi.mock("./lib/genlayer", async () => {
  const actual = await vi.importActual<typeof import("./lib/genlayer")>("./lib/genlayer");
  return {
    ...actual,
    createReadClient: vi.fn(() => ({})),
    discoverWalletProviders: vi.fn(async () => [{ id: "wallet", name: "Test wallet", icon: "", rdns: "test.wallet", provider: { request: vi.fn() } }]),
    connectWallet: vi.fn(async (_config, provider) => ({ client: {}, address: builder, provider })),
    writeAndVerify: vi.fn(async (_config, _functionName, _args, _value, onSubmitted) => {
      onSubmitted?.("0xabc");
      return { hash: "0xabc", address: builder, lifecycle: "FINALIZED", executionResult: "FINISHED_WITH_RETURN", consensusResult: "AGREE", childTransactions: [] };
    }),
    readRouterSettlement: vi.fn(async () => ({ source: contract, dealHash: `0x${"1".repeat(64)}`, recipient: builder, amount: 20000000000000000n, kind: 1, state: 2 })),
    releaseRouterSettlement: vi.fn(async () => `0x${"2".repeat(64)}`),
    readJsonView: vi.fn()
  };
});

function mockViews() {
  vi.mocked(genlayer.readJsonView).mockImplementation(async (_client, _config, functionName) => {
    if (functionName === "get_deal_ids" || functionName === "get_offer_ids") return ["1"];
    if (functionName === "get_dashboard_stats") return stats;
    if (functionName === "get_deal") return deal;
    if (functionName === "get_offer") return offer;
    if (functionName === "get_deal_history") return history;
    if (functionName === "get_evidence_rounds") return rounds;
    if (functionName === "get_refund_eligibility") return { eligible: false, reason: "Deal is already settled" };
    throw new Error(`Unexpected view ${functionName}`);
  });
}

describe("ClauseFlow v2", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    window.history.replaceState({}, "", "/");
    runtimeWindow().CLAUSEFLOW_CONFIG = { contractAddress: contract, settlementRouter: router, protocolVersion: "v2", chain: "testnetBradbury", explorerUrl: "https://explorer-bradbury.genlayer.com", stateStatus: "accepted" };
    mockViews();
  });

  it("treats timeout as recoverable but disagreement as terminal", () => {
    expect(genlayer.isTerminalTransactionFailure("VALIDATORS_TIMEOUT")).toBe(false);
    expect(genlayer.isTerminalTransactionFailure("UNDETERMINED")).toBe(true);
    expect(genlayer.isTerminalTransactionFailure("CANCELED")).toBe(true);
  });

  it("loads only canonical v2 dashboard state", async () => {
    render(<App />);
    expect(await screen.findByText(offer.title)).toBeTruthy();
    expect(screen.getByText("PAID")).toBeTruthy();
    expect(screen.getAllByText("0.02").length).toBeGreaterThan(0);
    expect(screen.queryByText("[object Object]")).toBeNull();
  });

  it("keeps a matching snapshot visible when live Bradbury refresh fails", async () => {
    window.localStorage.setItem(`clauseflow:dashboard:${contract}`, JSON.stringify(snapshot()));
    vi.mocked(genlayer.readJsonView).mockRejectedValue(new Error("Bradbury timeout"));
    render(<App />);
    expect(screen.getByText(offer.title)).toBeTruthy();
    expect(await screen.findByText(/Snapshot retained/i)).toBeTruthy();
    expect(screen.getByText("PAID")).toBeTruthy();
  });

  it("does not reuse a snapshot across contract addresses", () => {
    window.localStorage.setItem(`clauseflow:dashboard:${contract}`, JSON.stringify(snapshot({ histories: {} })));
    runtimeWindow().CLAUSEFLOW_CONFIG = { ...runtimeWindow().CLAUSEFLOW_CONFIG!, contractAddress: "0x5555555555555555555555555555555555555555" };
    vi.mocked(genlayer.readJsonView).mockImplementation(() => new Promise(() => undefined));
    render(<App />);
    expect(screen.queryByText(offer.title)).toBeNull();
    expect(screen.getByText(/Reading Bradbury state/i)).toBeTruthy();
  });

  it("rejects a v2 snapshot from a different settlement router", () => {
    window.localStorage.setItem(`clauseflow:dashboard:${contract}`, JSON.stringify(snapshot({ settlementRouter: "0x5555555555555555555555555555555555555555" })));
    vi.mocked(genlayer.readJsonView).mockImplementation(() => new Promise(() => undefined));
    render(<App />);
    expect(screen.queryByText(offer.title)).toBeNull();
    expect(screen.getByText(/Reading Bradbury state/i)).toBeTruthy();
  });

  it("starts the v2 Builder workspace empty and requires exact obligations", async () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "New offer" }));
    expect((screen.getByRole("button", { name: /Publish reviewed offer/i }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByLabelText("Offer title") as HTMLInputElement).value).toBe("");
    expect(screen.getByText(/Every binding promise belongs in the obligation manifest/i)).toBeTruthy();
    expect(screen.queryByDisplayValue(/Example Domain/i)).toBeNull();
  });

  it("renders every on-chain obligation assessment without inventing prose", async () => {
    render(<App />);
    await screen.findByText(offer.title);
    fireEvent.click(screen.getByRole("button", { name: "Deal detail" }));
    fireEvent.click(screen.getByRole("button", { name: /Evidence & review/i }));
    expect(await screen.findByText("Full validator report")).toBeTruthy();
    expect(screen.getByText(/Every accepted obligation was adjudicated/i)).toBeTruthy();
    expect(screen.getByText(/independently fetched the pinned dossier/i)).toBeTruthy();
    expect(screen.getByText(/independently refetched every immutable source/i)).toBeTruthy();
    expect(screen.getAllByText("SATISFIED")).toHaveLength(2);
  });

  it("states when detailed review data was not stored instead of fabricating it", async () => {
    const fallbackDeal = { ...deal, reviewObligationAssessments: "" };
    mockViews();
    vi.mocked(genlayer.readJsonView).mockImplementation(async (_client, _config, functionName) => {
      if (functionName === "get_deal_ids" || functionName === "get_offer_ids") return ["1"];
      if (functionName === "get_dashboard_stats") return stats;
      if (functionName === "get_deal") return fallbackDeal;
      if (functionName === "get_offer") return offer;
      if (functionName === "get_deal_history") return history;
      if (functionName === "get_evidence_rounds") return rounds;
      if (functionName === "get_refund_eligibility") return { eligible: false, reason: "Settled" };
      throw new Error(functionName);
    });
    render(<App />);
    await screen.findByText(offer.title);
    fireEvent.click(screen.getByRole("button", { name: "Deal detail" }));
    fireEvent.click(screen.getByRole("button", { name: /Evidence & review/i }));
    expect(await screen.findByText(/No obligation-level report was stored/i)).toBeTruthy();
    expect(screen.queryByText(/independently fetched the pinned dossier/i)).toBeNull();
  });

  it("shows the exact immutable evidence version and hash", async () => {
    render(<App />);
    await screen.findByText(offer.title);
    fireEvent.click(screen.getByRole("button", { name: "Deal detail" }));
    fireEvent.click(screen.getByRole("button", { name: /Evidence & review/i }));
    const roundTitle = await screen.findByText(/Round 1/i);
    const round = roundTitle.closest("article")!;
    expect(within(round).getByText(/GIT_COMMIT/i)).toBeTruthy();
    expect(within(round).getAllByText(/sha256/i)).toHaveLength(2);
  });

  it("shows the deal-specific router receipt", async () => {
    render(<App />);
    await screen.findByText(offer.title);
    fireEvent.click(screen.getByRole("button", { name: "Deal detail" }));
    expect(await screen.findByText(/CLAUSEFLOW:1:PAYMENT:1/i)).toBeTruthy();
    expect(screen.getByText("Released")).toBeTruthy();
    expect(vi.mocked(genlayer.readRouterSettlement)).toHaveBeenCalledWith(expect.objectContaining({ settlementRouter: router }), deal.settlementId);
  });

  it("exposes the old contract only as a read-only archive", async () => {
    const archiveAddress = "0x6666666666666666666666666666666666666666";
    runtimeWindow().CLAUSEFLOW_CONFIG = { ...runtimeWindow().CLAUSEFLOW_CONFIG!, archives: [{ contractAddress: archiveAddress, protocolVersion: "v1", chain: "testnetBradbury", explorerUrl: "https://explorer-bradbury.genlayer.com", readOnly: true, label: "Archived v1 pilot" }] };
    render(<App />);
    await screen.findByText(offer.title);
    fireEvent.click(screen.getByRole("button", { name: /Archived v1 pilot/i }));
    expect(await screen.findByText(/This contract is preserved for historical transparency/i)).toBeTruthy();
    expect((screen.getByRole("button", { name: "New offer" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("normalizes wallet execution objects instead of rendering object Object", async () => {
    vi.mocked(genlayer.writeAndVerify).mockRejectedValueOnce({ shortMessage: "Contract execution failed cleanly" });
    render(<App />);
    await screen.findByText(offer.title);
    fireEvent.click(screen.getByRole("button", { name: "Offers" }));
    fireEvent.click(await screen.findByRole("button", { name: /Accept & Lock 0.02 GEN/i }));
    expect(await screen.findByText("Contract execution failed cleanly")).toBeTruthy();
    expect(screen.queryByText("[object Object]")).toBeNull();
    await waitFor(() => expect(genlayer.writeAndVerify).toHaveBeenCalled());
  });
});
