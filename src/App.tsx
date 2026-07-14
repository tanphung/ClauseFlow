import {
  Activity,
  BadgeCheck,
  Banknote,
  CheckCircle2,
  Clock3,
  ExternalLink,
  FileText,
  Filter,
  GitBranch,
  LockKeyhole,
  RefreshCcw,
  Search,
  ShieldCheck,
  Sparkles,
  Wallet
} from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { connectWallet, createReadClient, explorerAddressUrl, explorerTxUrl, hasContractAddress, readJsonView, writeAndVerify, type ClauseFlowConfig } from "./lib/genlayer";
import type { CalldataEncodable } from "genlayer-js/types";

type DealStatus = "FUNDED" | "SUBMITTED" | "APPROVED" | "REVISION_REQUIRED" | "REJECTED" | "PAYMENT_PENDING" | "REFUND_PENDING" | "PAID" | "REFUNDED";

type Deal = {
  id: string;
  offerId: string;
  title: string;
  builder: string;
  client: string;
  lockedAttoGen: string;
  status: DealStatus;
  fundedAt: string;
  submittedAt: string;
  reviewedAt: string;
  completedAt: string;
  paidAt: string;
  refundedAt: string;
  deadlineAtUnix: string;
  refundAvailableAtUnix: string;
  deliveryUrl: string;
  githubUrl: string;
  demoUrl: string;
  documentationUrl: string;
  deliveryNote: string;
  reviewResult: string;
  reviewScore: string;
  reviewReason: string;
  revisionChecklist: string;
  nextAction: string;
  paymentTxType: string;
  paid: string;
  refunded: string;
};

type Offer = {
  id: string;
  title: string;
  builder: string;
  priceAttoGen: string;
  deadlineDays: string;
  revisionRounds: string;
  scope: string;
  deliverables: string;
  acceptanceCriteria: string;
  refundRule: string;
  referenceUrls: string;
  structuredClauses: string;
  status: string;
};

type HistoryEvent = {
  eventType: string;
  note: string;
  timestamp: string;
  actor: string;
};

type Stats = {
  totalOffers: string;
  totalDeals: string;
  activeDeals: string;
  completedDeals: string;
  totalFundedAtto: string;
  totalPaidAtto: string;
  totalRefundedAtto: string;
  contractBalanceAtto: string;
  accountedEscrowAtto: string;
};

type StructuredClauses = {
  scope: string;
  deliverables: string;
  acceptanceCriteria: string;
  deadline: string;
  revisionRules: string;
  paymentTerms: string;
  refundConditions: string;
  summary: string;
};

type StructuredDraft = {
  builder: string;
  title: string;
  serviceDescription: string;
  scope: string;
  deliverables: string;
  acceptanceCriteria: string;
  priceAttoGen: string;
  deadlineDays: string;
  revisionRounds: string;
  revisionWindowHours: string;
  gracePeriodHours: string;
  refundRule: string;
  clauses: StructuredClauses;
  structuredAt: string;
  publishedOfferId: string;
};

type TxState = {
  hash: string;
  label: string;
  lifecycle: "idle" | "pending" | "accepted" | "finalized" | "failed";
  executionResult: string;
  consensusResult: string;
  message: string;
  childTransactions: string[];
};

const defaultStats: Stats = {
  totalOffers: "0",
  totalDeals: "0",
  activeDeals: "0",
  completedDeals: "0",
  totalFundedAtto: "0",
  totalPaidAtto: "0",
  totalRefundedAtto: "0",
  contractBalanceAtto: "0",
  accountedEscrowAtto: "0"
};

export function App() {
  const [view, setView] = useState<"dashboard" | "offers" | "create" | "deal">("dashboard");
  const [config, setConfig] = useState<ClauseFlowConfig | null>(null);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [stats, setStats] = useState<Stats>(defaultStats);
  const [histories, setHistories] = useState<Record<string, HistoryEvent[]>>({});
  const [selectedDealId, setSelectedDealId] = useState("");
  const [filter, setFilter] = useState("");
  const [builderFilter, setBuilderFilter] = useState("");
  const [clientFilter, setClientFilter] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [walletAddress, setWalletAddress] = useState("");
  const [txState, setTxState] = useState<TxState>({
    hash: "",
    label: "No transaction submitted in this browser session.",
    lifecycle: "idle",
    executionResult: "NOT_SUBMITTED",
    consensusResult: "IDLE",
    message: "Read-only dashboard is available without connecting a wallet.",
    childTransactions: []
  });

  const selectedDeal = deals.find((deal) => deal.id === selectedDealId) || deals[0];
  const filteredDeals = useMemo(() => {
    const query = filter.trim().toLowerCase();
    const builder = builderFilter.trim().toLowerCase();
    const client = clientFilter.trim().toLowerCase();
    return deals.filter((deal) => {
      const matchesQuery = !query || deal.builder.toLowerCase().includes(query) || deal.client.toLowerCase().includes(query) || deal.title.toLowerCase().includes(query);
      const matchesBuilder = !builder || deal.builder.toLowerCase().includes(builder);
      const matchesClient = !client || deal.client.toLowerCase().includes(client);
      return matchesQuery && matchesBuilder && matchesClient;
    });
  }, [builderFilter, clientFilter, deals, filter]);

  useEffect(() => {
    void refreshFromChain();
  }, []);

  async function refreshFromChain() {
    const cfg = (window as unknown as { CLAUSEFLOW_CONFIG?: ClauseFlowConfig }).CLAUSEFLOW_CONFIG || {
      contractAddress: "",
      chain: "testnetBradbury",
      explorerUrl: "https://explorer-bradbury.genlayer.com",
      stateStatus: "accepted"
    };
    setConfig(cfg);
    if (!hasContractAddress(cfg)) {
      setLoadError("No verified Bradbury contract address is configured. On-chain data is unavailable.");
      return;
    }
    setLoading(true);
    setLoadError("");
    try {
      const client = createReadClient(cfg);
      const [offerIds, dealIds, chainStats] = await Promise.all([
        readJsonView<string[]>(client, cfg, "get_offer_ids", []),
        readJsonView<string[]>(client, cfg, "get_deal_ids", []),
        readJsonView<Stats>(client, cfg, "get_dashboard_stats", [])
      ]);
      const chainOffers = await Promise.all(offerIds.map((id) => readJsonView<Offer>(client, cfg, "get_offer", [id])));
      const chainDeals = await Promise.all(dealIds.map((id) => readJsonView<Deal>(client, cfg, "get_deal", [id])));
      const chainHistories: Record<string, HistoryEvent[]> = {};
      await Promise.all(
        dealIds.map(async (id) => {
          chainHistories[id] = await readJsonView<HistoryEvent[]>(client, cfg, "get_deal_history", [id]);
        })
      );
      setOffers(chainOffers);
      setDeals(chainDeals);
      setStats(chainStats);
      setHistories(chainHistories);
      if (chainDeals[0]) setSelectedDealId(chainDeals[0].id);
    } catch (error) {
      setLoadError(`Could not read Bradbury contract state: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setLoading(false);
    }
  }

  async function handleConnectWallet() {
    if (!config) return;
    try {
      const connected = await connectWallet(config);
      setWalletAddress(connected.address);
      setLoadError("");
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : String(error));
    }
  }

  async function executeWrite(label: string, functionName: string, args: CalldataEncodable[], value = 0n) {
    if (!config) throw new Error("App config is not loaded.");
    setTxState({ hash: "", label, lifecycle: "pending", executionResult: "WAITING_FOR_SIGNATURE", consensusResult: "IDLE", message: "Confirm the transaction in your wallet.", childTransactions: [] });
    try {
      const result = await writeAndVerify(config, functionName, args, value, (hash) => {
        setTxState({ hash, label, lifecycle: "pending", executionResult: "WAITING_FOR_CONSENSUS", consensusResult: "PENDING", message: "Transaction submitted. Waiting for validator consensus.", childTransactions: [] });
      });
      setWalletAddress(result.address);
      setTxState({ hash: result.hash, label, lifecycle: result.lifecycle === "FINALIZED" ? "finalized" : "accepted", executionResult: result.executionResult, consensusResult: result.consensusResult, message: result.childTransactions.length ? "Parent execution succeeded. Child GEN transfer IDs are shown below for independent verification." : "Execution and consensus succeeded; on-chain state is being refreshed.", childTransactions: result.childTransactions });
      await refreshFromChain();
      return result;
    } catch (error) {
      setTxState((current) => ({ ...current, lifecycle: "failed", executionResult: current.executionResult === "WAITING_FOR_SIGNATURE" ? "NOT_SUBMITTED" : current.executionResult, consensusResult: error instanceof Error && error.message.startsWith("CONSENSUS_") ? error.message.split(":")[0].replace("CONSENSUS_", "") : current.consensusResult, message: error instanceof Error ? error.message : String(error) }));
      throw error;
    }
  }

  return (
    <main>
      <aside>
        <div className="brand">
          <ShieldCheck size={26} />
          <span>ClauseFlow</span>
        </div>
        <nav>
          <button className={view === "dashboard" ? "active" : ""} onClick={() => setView("dashboard")}><Activity size={16} /> Dashboard</button>
          <button className={view === "offers" ? "active" : ""} onClick={() => setView("offers")}><FileText size={16} /> Offers</button>
          <button className={view === "create" ? "active" : ""} onClick={() => setView("create")}><Sparkles size={16} /> Create</button>
          <button className={view === "deal" ? "active" : ""} onClick={() => setView("deal")}><LockKeyhole size={16} /> Deal Detail</button>
        </nav>
        <section className="network">
          <span>{config?.chain || "testnetBradbury"}</span>
          <strong>{hasContractAddress(config) ? short(config?.contractAddress || "") : "Contract not configured"}</strong>
        </section>
      </aside>

      <section className="workspace">
        <header>
          <div>
            <p className="eyebrow">GenLayer agreement platform</p>
            <h1>{titleFor(view)}</h1>
          </div>
          <div className="headerActions">
            <button onClick={refreshFromChain}><RefreshCcw size={16} /> Refresh On-chain</button>
            <button onClick={handleConnectWallet}><Wallet size={16} /> {walletAddress ? short(walletAddress) : "Connect wallet"}</button>
            {config?.contractAddress && <a className="buttonLink" href={explorerAddressUrl(config, config.contractAddress)} target="_blank" rel="noreferrer"><ExternalLink size={16} /> Contract</a>}
          </div>
        </header>

        {loadError && <div className="notice">{loadError}</div>}
        {loading && <div className="notice">Loading Bradbury contract views...</div>}
        {txState.lifecycle !== "idle" && <TransactionBanner txState={txState} config={config} />}

        {view === "dashboard" && (
          <Dashboard
            stats={stats}
            deals={filteredDeals}
            filter={filter}
            setFilter={setFilter}
            builderFilter={builderFilter}
            setBuilderFilter={setBuilderFilter}
            clientFilter={clientFilter}
            setClientFilter={setClientFilter}
            selectDeal={(dealId) => {
              setSelectedDealId(dealId);
              setView("deal");
            }}
            config={config}
          />
        )}

        {view === "offers" && <Offers offers={offers} executeWrite={executeWrite} />}

        {view === "create" && <CreateOffer executeWrite={executeWrite} config={config} walletAddress={walletAddress} />}

        {view === "deal" && selectedDeal && (
          <DealDetail
            deal={selectedDeal}
            offer={offers.find((offer) => offer.id === selectedDeal.offerId)}
            history={histories[selectedDeal.id] || []}
            txState={txState}
            executeWrite={executeWrite}
            config={config}
            walletAddress={walletAddress}
          />
        )}
        {view === "deal" && !selectedDeal && <section className="panel emptyState"><h2>No on-chain deals yet</h2><p>Publish an offer and fund it to start the agreement timeline.</p></section>}
      </section>
    </main>
  );
}

function Dashboard({ stats, deals, filter, setFilter, builderFilter, setBuilderFilter, clientFilter, setClientFilter, selectDeal, config }: { stats: Stats; deals: Deal[]; filter: string; setFilter: (value: string) => void; builderFilter: string; setBuilderFilter: (value: string) => void; clientFilter: string; setClientFilter: (value: string) => void; selectDeal: (dealId: string) => void; config: ClauseFlowConfig | null }) {
  return (
    <div className="grid">
      <section className="statsGrid">
        <Metric icon={<FileText size={18} />} label="Offers" value={stats.totalOffers} />
        <Metric icon={<LockKeyhole size={18} />} label="Funded deals" value={stats.totalDeals} />
        <Metric icon={<BadgeCheck size={18} />} label="Completed" value={stats.completedDeals} />
        <Metric icon={<Banknote size={18} />} label="GEN paid" value={formatGen(stats.totalPaidAtto)} />
        <Metric icon={<RefreshCcw size={18} />} label="GEN refunded" value={formatGen(stats.totalRefundedAtto)} />
      </section>

      <section className="panel">
        <div className="sectionTitle">
          <h2>On-chain contract and payment history</h2>
          <div className="filterBox"><Search size={16} /><input value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="Filter by builder, client, or title" /></div>
        </div>
        <div className="partyFilters">
          <label>Builder address<input aria-label="Builder address filter" value={builderFilter} onChange={(event) => setBuilderFilter(event.target.value)} placeholder="0x..." /></label>
          <label>Client address<input aria-label="Client address filter" value={clientFilter} onChange={(event) => setClientFilter(event.target.value)} placeholder="0x..." /></label>
        </div>
        <div className="table">
          <div className="row head"><span>Deal</span><span>Parties</span><span>Amount</span><span>Status</span><span>Completed</span><span>Proof</span></div>
          {deals.map((deal) => (
            <button className="row" key={deal.id} onClick={() => selectDeal(deal.id)}>
              <span>#{deal.id} {deal.title}</span>
              <span>{short(deal.builder)} {"->"} {short(deal.client)}</span>
              <span>{formatGen(deal.lockedAttoGen)} GEN</span>
              <span><Status status={deal.status} /></span>
              <span>{deal.completedAt || deal.paidAt || deal.refundedAt || "Pending"}</span>
              <span>{config?.contractAddress ? "Explorer" : "Local preview"}</span>
            </button>
          ))}
          {deals.length === 0 && <div className="emptyState">No on-chain agreements yet. Publish and fund an offer to begin.</div>}
        </div>
      </section>
    </div>
  );
}

type ExecuteWrite = (label: string, functionName: string, args: CalldataEncodable[], value?: bigint) => Promise<unknown>;

function Offers({ offers, executeWrite }: { offers: Offer[]; executeWrite: ExecuteWrite }) {
  return (
    <div className="grid two">
      <section className="panel">
        <div className="sectionTitle"><h2>Published offers</h2><span>{offers.length} on-chain</span></div>
        <div className="offerList">
          {offers.map((offer) => (
            <article className="offerCard" key={offer.id}>
              <strong>{offer.title}</strong>
              <p>{offer.scope}</p>
              <dl>
                <dt>Builder</dt><dd>{short(offer.builder)}</dd>
                <dt>Price</dt><dd>{formatGen(offer.priceAttoGen)} GEN</dd>
                <dt>Deadline</dt><dd>{offer.deadlineDays} days</dd>
                <dt>Revisions</dt><dd>{offer.revisionRounds}</dd>
              </dl>
              <OfferClauses value={offer.structuredClauses} />
              <button className="primary wide" onClick={() => void executeWrite("Accept & Lock GEN", "accept_offer", [offer.id], BigInt(offer.priceAttoGen)).catch(() => undefined)}><LockKeyhole size={16} /> Accept & Lock GEN</button>
            </article>
          ))}
        </div>
      </section>
      <section className="panel">
        <h2>Transaction truth</h2>
        <p>Wallet writes require both validator agreement and `FINISHED_WITH_RETURN` before the UI marks applied state.</p>
        <div className="clause"><h3>Protected from fake success</h3><ul><li>Lifecycle status alone is not enough.</li><li>State refresh runs after successful execution result.</li><li>Explorer links are displayed separately from app status.</li></ul></div>
      </section>
    </div>
  );
}

function CreateOffer({ executeWrite, config, walletAddress }: { executeWrite: ExecuteWrite; config: ClauseFlowConfig | null; walletAddress: string }) {
  const [form, setForm] = useState({
    title: "Build a verified public example page",
    serviceDescription: "Deliver a public page that validators can fetch and verify.",
    scope: "Provide a publicly accessible page showing the Example Domain content.",
    deliverables: "A working HTTPS delivery URL with visible Example Domain text.",
    acceptanceCriteria: "The URL is accessible and the page visibly contains Example Domain.",
    price: "0.1",
    deadlineDays: "1",
    revisionRounds: "1",
    revisionWindowHours: "24",
    gracePeriodHours: "24",
    refundRule: "Client may claim a refund after deadline plus grace period if no valid delivery is submitted.",
    referenceUrls: "https://example.com"
  });
  const [draft, setDraft] = useState<StructuredDraft | null>(null);
  const [draftError, setDraftError] = useState("");
  const setField = (field: keyof typeof form, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
    setDraftError("Offer fields changed. Run clause structuring again before publishing.");
  };
  const structure = async () => {
    setDraftError("");
    const result = await executeWrite("Structure Clauses", "structure_offer", [
      form.title,
      form.serviceDescription,
      form.scope,
      form.deliverables,
      form.acceptanceCriteria,
      parseGen(form.price),
      BigInt(form.deadlineDays),
      BigInt(form.revisionRounds),
      BigInt(form.revisionWindowHours),
      BigInt(form.gracePeriodHours),
      form.refundRule
    ]) as { address?: string };
    const builder = result.address || walletAddress;
    if (!config || !builder) throw new Error("Connect a wallet to load the structured draft.");
    const client = createReadClient(config);
    const chainDraft = await readJsonView<StructuredDraft>(client, config, "get_structured_offer", [builder]);
    setDraft(chainDraft);
  };
  const publish = () => executeWrite("Publish Offer", "publish_offer", [
    form.title,
    form.serviceDescription,
    form.scope,
    form.deliverables,
    form.acceptanceCriteria,
    parseGen(form.price),
    BigInt(form.deadlineDays),
    BigInt(form.revisionRounds),
    BigInt(form.revisionWindowHours),
    BigInt(form.gracePeriodHours),
    form.refundRule,
    form.referenceUrls
  ]);
  return (
    <div className="grid two">
      <section className="panel formPanel">
        <h2>Builder offer</h2>
        <input aria-label="Offer title" value={form.title} onChange={(event) => setField("title", event.target.value)} />
        <textarea aria-label="Service description" value={form.serviceDescription} onChange={(event) => setField("serviceDescription", event.target.value)} />
        <textarea aria-label="Detailed scope" value={form.scope} onChange={(event) => setField("scope", event.target.value)} />
        <textarea aria-label="Deliverables" value={form.deliverables} onChange={(event) => setField("deliverables", event.target.value)} />
        <textarea aria-label="Acceptance criteria" value={form.acceptanceCriteria} onChange={(event) => setField("acceptanceCriteria", event.target.value)} />
        <div className="fields"><input aria-label="Price in GEN" value={form.price} onChange={(event) => setField("price", event.target.value)} /><input aria-label="Deadline days" value={form.deadlineDays} onChange={(event) => setField("deadlineDays", event.target.value)} /><input aria-label="Revision rounds" value={form.revisionRounds} onChange={(event) => setField("revisionRounds", event.target.value)} /><input aria-label="Grace period hours" value={form.gracePeriodHours} onChange={(event) => setField("gracePeriodHours", event.target.value)} /></div>
        <textarea aria-label="Refund rule" value={form.refundRule} onChange={(event) => setField("refundRule", event.target.value)} />
        <input aria-label="Reference URLs" value={form.referenceUrls} onChange={(event) => setField("referenceUrls", event.target.value)} />
        <button className="wide" onClick={() => void structure().catch((error) => setDraftError(error instanceof Error ? error.message : String(error)))}><Sparkles size={16} /> Structure Clauses</button>
        <button className="primary wide" disabled={!draft || Boolean(draftError) || Boolean(draft.publishedOfferId)} onClick={() => void publish().catch(() => undefined)}><FileText size={16} /> Publish Reviewed Offer</button>
      </section>
      <section className="panel">
        <div className="sectionTitle"><h2>Contract-structured clauses</h2><span>{draft ? "Stored on-chain" : "Not structured"}</span></div>
        {draftError && <div className="notice warning">{draftError}</div>}
        {!draft && <div className="emptyState">Structure the offer to generate a contract-owned draft. Publishing stays locked until the reviewed clauses are loaded from Bradbury.</div>}
        {draft && <div className="draftClauses">
          <ClauseBlock title="Scope" items={[draft.clauses.scope]} />
          <ClauseBlock title="Deliverables" items={[draft.clauses.deliverables]} />
          <ClauseBlock title="Acceptance criteria" items={[draft.clauses.acceptanceCriteria]} />
          <ClauseBlock title="Deadline" items={[draft.clauses.deadline]} />
          <ClauseBlock title="Revision rules" items={[draft.clauses.revisionRules]} />
          <ClauseBlock title="Payment" items={[draft.clauses.paymentTerms]} />
          <ClauseBlock title="Refund" items={[draft.clauses.refundConditions]} />
          <p className="draftMeta">Structured {formatDate(draft.structuredAt)} for {short(draft.builder)}</p>
        </div>}
      </section>
    </div>
  );
}

function DealDetail({ deal, offer, history, txState, executeWrite, config, walletAddress }: { deal: Deal; offer?: Offer; history: HistoryEvent[]; txState: TxState; executeWrite: ExecuteWrite; config: ClauseFlowConfig | null; walletAddress: string }) {
  const [delivery, setDelivery] = useState({ deliveryUrl: "https://example.com", githubUrl: "", demoUrl: "https://example.com", documentationUrl: "https://www.iana.org/help/example-domains", deliveryNote: "The public delivery is accessible and visibly contains the agreed Example Domain content." });
  const isBuilder = walletAddress.toLowerCase() === deal.builder.toLowerCase();
  const isClient = walletAddress.toLowerCase() === deal.client.toLowerCase();
  return (
    <section className="panel dealPanel">
      <div className="dealHeader">
        <div><p className="eyebrow">Deal #{deal.id}</p><h2>{deal.title}</h2></div>
        <Status status={deal.status} />
      </div>
      <div className="timeline">{["FUNDED", "SUBMITTED", "REVIEWED", settlementStep(deal)].map((event) => <span className={history.some((item) => item.eventType === event) || deal.status === event ? "done" : ""} key={event}>{event}</span>)}</div>
      <div className="grid three">
        <Metric icon={<Wallet size={18} />} label="Builder" value={short(deal.builder)} />
        <Metric icon={<Filter size={18} />} label="Client" value={short(deal.client)} />
        <Metric icon={<Banknote size={18} />} label="Locked GEN" value={formatGen(deal.lockedAttoGen)} />
      </div>
      <div className="dealMeta">
        <span><Clock3 size={15} /> Deadline {formatUnix(deal.deadlineAtUnix)}</span>
        <span><RefreshCcw size={15} /> Refund eligibility {formatUnix(deal.refundAvailableAtUnix)}</span>
      </div>
      {offer && <section className="acceptedTerms"><h3>Accepted on-chain clauses</h3><OfferClauses value={offer.structuredClauses} /></section>}
      <div className="execution">
        <section>
          <h3>Evidence package</h3>
          <p>{deal.deliveryNote || "No delivery note yet."}</p>
          <LinkLine label="Delivery" href={deal.deliveryUrl} />
          <LinkLine label="Demo" href={deal.demoUrl} />
          <LinkLine label="Docs" href={deal.documentationUrl} />
          <LinkLine label="GitHub" href={deal.githubUrl} />
          {deal.status === "FUNDED" || deal.status === "REVISION_REQUIRED" ? <div className="deliveryForm">
            <input aria-label="Delivery URL" value={delivery.deliveryUrl} onChange={(event) => setDelivery({ ...delivery, deliveryUrl: event.target.value })} />
            <input aria-label="GitHub URL" value={delivery.githubUrl} onChange={(event) => setDelivery({ ...delivery, githubUrl: event.target.value })} />
            <input aria-label="Demo URL" value={delivery.demoUrl} onChange={(event) => setDelivery({ ...delivery, demoUrl: event.target.value })} />
            <input aria-label="Documentation URL" value={delivery.documentationUrl} onChange={(event) => setDelivery({ ...delivery, documentationUrl: event.target.value })} />
            <textarea aria-label="Delivery note" value={delivery.deliveryNote} onChange={(event) => setDelivery({ ...delivery, deliveryNote: event.target.value })} />
          </div> : null}
          <button disabled={!isBuilder || !["FUNDED", "REVISION_REQUIRED"].includes(deal.status)} onClick={() => void executeWrite("Submit Delivery", "submit_delivery", [deal.id, delivery.deliveryUrl, delivery.githubUrl, delivery.demoUrl, delivery.documentationUrl, delivery.deliveryNote]).catch(() => undefined)}><GitBranch size={16} /> Submit Delivery</button>
        </section>
        <section className="review">
          <h3>GenLayer review result</h3>
          <strong>{deal.reviewResult || "Not reviewed"} / {deal.reviewScore || "0"}%</strong>
          <p>{deal.reviewReason || deal.nextAction}</p>
          {deal.revisionChecklist && <ClauseBlock title="Revision checklist" items={[deal.revisionChecklist]} />}
          <div className="actions">
            <button onClick={() => void executeWrite("Run Review", "review_delivery", [deal.id]).catch(() => undefined)} disabled={deal.status !== "SUBMITTED"}><Sparkles size={16} /> Run Review</button>
            <button className="primary" onClick={() => void executeWrite("Claim Payment", "claim_payment", [deal.id]).catch(() => undefined)} disabled={!isBuilder || deal.status !== "APPROVED"}><LockKeyhole size={16} /> Claim Payment</button>
            <button onClick={() => void executeWrite("Claim Refund", "claim_refund", [deal.id]).catch(() => undefined)} disabled={!isClient || !["REJECTED", "FUNDED", "REVISION_REQUIRED"].includes(deal.status)}>Claim Refund</button>
            <button onClick={() => void executeWrite("Confirm Payment", "confirm_payment", [deal.id]).catch(() => undefined)} disabled={deal.status !== "PAYMENT_PENDING"}>Confirm Payment</button>
            <button onClick={() => void executeWrite("Confirm Refund", "confirm_refund", [deal.id]).catch(() => undefined)} disabled={deal.status !== "REFUND_PENDING"}>Confirm Refund</button>
          </div>
        </section>
      </div>
      <section className="txPanel">
        <h3>Transaction truth panel</h3>
        <dl>
          <dt>Action</dt><dd>{txState.label}</dd>
          <dt>Lifecycle</dt><dd>{txState.lifecycle}</dd>
          <dt>Execution</dt><dd>{txState.executionResult}</dd>
          <dt>Consensus</dt><dd>{txState.consensusResult}</dd>
          <dt>Hash</dt><dd>{txState.hash.startsWith("0x") && config ? <a href={explorerTxUrl(config, txState.hash)} target="_blank" rel="noreferrer">{txState.hash}</a> : txState.hash || "None"}</dd>
        </dl>
        <p>{txState.message}</p>
        {txState.childTransactions.map((hash) => config ? <a key={hash} href={explorerTxUrl(config, hash)} target="_blank" rel="noreferrer">Child GEN transfer {short(hash)}</a> : null)}
      </section>
      <section className="panel inset">
        <h3>On-chain lifecycle history</h3>
        <div className="historyList">
          {history.map((event, index) => <div key={`${event.eventType}-${index}`}><strong>{event.eventType}</strong><span>{event.timestamp}</span><p>{event.note}</p><small>{short(event.actor)}</small></div>)}
        </div>
      </section>
    </section>
  );
}

function Metric({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return <div className="info">{icon}<span>{label}</span><strong>{value}</strong></div>;
}

function TransactionBanner({ txState, config }: { txState: TxState; config: ClauseFlowConfig | null }) {
  return <section className={`txBanner ${txState.lifecycle}`}>
    <div><strong>{txState.label}</strong><span>{txState.lifecycle} / {txState.consensusResult} / {txState.executionResult}</span></div>
    <p>{txState.message}</p>
    {txState.hash && config ? <a href={explorerTxUrl(config, txState.hash)} target="_blank" rel="noreferrer"><ExternalLink size={14} /> View transaction</a> : null}
  </section>;
}

function ClauseBlock({ title, items }: { title: string; items: string[] }) {
  return <div className="clause"><h3>{title}</h3><ul>{items.map((item) => <li key={item}>{item}</li>)}</ul></div>;
}

function OfferClauses({ value }: { value: string }) {
  const clauses = parseStructuredClauses(value);
  if (!clauses) return <div className="notice warning">Structured clauses are unavailable for this offer.</div>;
  return <details className="offerClauses">
    <summary>Review accepted clauses</summary>
    <ClauseBlock title="Scope" items={[clauses.scope]} />
    <ClauseBlock title="Deliverables" items={[clauses.deliverables]} />
    <ClauseBlock title="Acceptance criteria" items={[clauses.acceptanceCriteria]} />
    <ClauseBlock title="Deadline" items={[clauses.deadline]} />
    <ClauseBlock title="Revision rules" items={[clauses.revisionRules]} />
    <ClauseBlock title="Payment" items={[clauses.paymentTerms]} />
    <ClauseBlock title="Refund" items={[clauses.refundConditions]} />
  </details>;
}

function LinkLine({ label, href }: { label: string; href: string }) {
  return <p className="linkLine"><span>{label}</span>{href ? <a href={href} target="_blank" rel="noreferrer">{href}</a> : <em>Not provided</em>}</p>;
}

function Status({ status }: { status: string }) {
  return <span className={`status ${status.toLowerCase().replaceAll("_", "")}`}><CheckCircle2 size={12} /> {status.replaceAll("_", " ")}</span>;
}

function titleFor(view: string) {
  if (view === "offers") return "Published Builder offers";
  if (view === "create") return "Create a ready-to-accept offer";
  if (view === "deal") return "Deal execution detail";
  return "Public on-chain agreement dashboard";
}

function settlementStep(deal: Deal) {
  if (deal.status === "PAYMENT_PENDING") return "PAYMENT_PENDING";
  if (deal.status === "REFUND_PENDING") return "REFUND_PENDING";
  return deal.paid === "true" ? "PAID" : "REFUNDED";
}

function formatGen(atto: string) {
  try {
    const value = BigInt(atto || "0");
    const whole = value / 10n ** 18n;
    const fraction = (value % 10n ** 18n).toString().padStart(18, "0").slice(0, 3).replace(/0+$/, "");
    return fraction ? `${whole}.${fraction}` : whole.toString();
  } catch {
    return "0";
  }
}

function parseGen(value: string) {
  const normalized = value.trim();
  if (!/^\d+(\.\d{1,18})?$/.test(normalized)) throw new Error("GEN amount must be a positive number with at most 18 decimals.");
  const [whole, fraction = ""] = normalized.split(".");
  return BigInt(whole) * 10n ** 18n + BigInt(fraction.padEnd(18, "0"));
}

function parseStructuredClauses(value: string): StructuredClauses | null {
  try {
    return JSON.parse(value) as StructuredClauses;
  } catch {
    return null;
  }
}

function short(address: string) {
  if (!address) return "Not set";
  if (address.length <= 12) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function formatDate(value: string) {
  if (!value) return "Pending";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function formatUnix(value: string) {
  const seconds = Number(value);
  if (!Number.isFinite(seconds) || seconds <= 0) return "Not set";
  return new Date(seconds * 1000).toLocaleString();
}
