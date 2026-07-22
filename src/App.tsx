import {
  Activity,
  ArrowRight,
  BadgeCheck,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  ClipboardCheck,
  ExternalLink,
  FileText,
  Filter,
  GitBranch,
  Landmark,
  Layers3,
  LockKeyhole,
  Menu,
  Plus,
  RefreshCcw,
  Search,
  ShieldCheck,
  Sparkles,
  Wallet,
  X
} from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { connectWallet, createReadClient, explorerAddressUrl, explorerTxUrl, hasContractAddress, normalizeError, readJsonView, writeAndVerify, type ClauseFlowConfig } from "./lib/genlayer";
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
  reviewEvidenceSummary?: string;
  reviewCriteriaResults?: string;
  reviewMissingItems?: string;
  reviewExecutiveSummary?: string;
  reviewCriterionAssessments?: string;
  reviewDeliverableAssessments?: string;
  reviewSourceAssessments?: string;
  reviewStrengths?: string;
  reviewRisks?: string;
  reviewConsensusBasis?: string;
};

type ReviewAssessment = {
  id: string;
  criterion: string;
  status: "SATISFIED" | "PARTIAL" | "NOT_SATISFIED" | "UNVERIFIABLE";
  finding: string;
  reasoning: string;
  evidenceUrls: string[];
};

type ReviewSource = {
  label: string;
  url: string;
  accessible: boolean;
  finding: string;
  relevance: string;
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
  milestones?: string;
  evidenceRequirements?: string;
  verificationPlan?: string;
  priceDisplay?: string;
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

export function App() {
  const [view, setView] = useState<"dashboard" | "offers" | "create" | "deal">("dashboard");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [config, setConfig] = useState<ClauseFlowConfig | null>(null);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [histories, setHistories] = useState<Record<string, HistoryEvent[]>>({});
  const [selectedDealId, setSelectedDealId] = useState("");
  const [filter, setFilter] = useState("");
  const [builderFilter, setBuilderFilter] = useState("");
  const [clientFilter, setClientFilter] = useState("");
  const [loading, setLoading] = useState(true);
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
      setLoading(false);
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
      setLoadError(`Could not read Bradbury contract state: ${normalizeError(error)}`);
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
      setLoadError(normalizeError(error));
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
      const message = normalizeError(error);
      setTxState((current) => ({ ...current, lifecycle: "failed", executionResult: current.executionResult === "WAITING_FOR_SIGNATURE" ? "NOT_SUBMITTED" : current.executionResult, consensusResult: message.startsWith("CONSENSUS_") ? message.split(":")[0].replace("CONSENSUS_", "") : current.consensusResult, message }));
      throw error;
    }
  }

  function openView(nextView: "dashboard" | "offers" | "create" | "deal") {
    setView(nextView);
    setMobileNavOpen(false);
    if (txState.lifecycle === "failed") {
      setTxState({ hash: "", label: "No transaction submitted in this browser session.", lifecycle: "idle", executionResult: "NOT_SUBMITTED", consensusResult: "IDLE", message: "Read-only dashboard is available without connecting a wallet.", childTransactions: [] });
    }
  }

  return (
    <main className="appShell">
      <aside className={mobileNavOpen ? "sidebar open" : "sidebar"}>
        <div className="brand">
          <span className="brandMark"><ShieldCheck size={21} strokeWidth={2.2} /></span>
          <span className="brandCopy">
            <strong>ClauseFlow</strong>
            <small>Agreement protocol</small>
          </span>
          <button className="mobileClose iconButton" aria-label="Close navigation" title="Close navigation" onClick={() => setMobileNavOpen(false)}><X size={18} /></button>
        </div>
        <nav aria-label="Primary navigation">
          <span className="navLabel">Workspace</span>
          <button className={view === "dashboard" ? "active" : ""} onClick={() => openView("dashboard")}><Activity size={16} /> Dashboard</button>
          <button className={view === "offers" ? "active" : ""} onClick={() => openView("offers")}><FileText size={16} /> Offers</button>
          <button aria-label="Create" className={view === "create" ? "active" : ""} onClick={() => openView("create")}><Plus size={16} /> New offer</button>
          <button className={view === "deal" ? "active" : ""} onClick={() => openView("deal")}><LockKeyhole size={16} /> Deal Detail</button>
        </nav>
        <section className="sidebarProof">
          <div className="proofIcon"><Landmark size={18} /></div>
          <div>
            <span className="networkState"><i /> Bradbury testnet</span>
            <strong>{hasContractAddress(config) ? short(config?.contractAddress || "") : "Contract unavailable"}</strong>
          </div>
          {config?.contractAddress && <a href={explorerAddressUrl(config, config.contractAddress)} target="_blank" rel="noreferrer" aria-label="Open contract in explorer" title="Open contract in explorer"><ExternalLink size={15} /></a>}
        </section>
      </aside>
      {mobileNavOpen && <button className="sidebarScrim" aria-label="Close navigation" onClick={() => setMobileNavOpen(false)} />}

      <section className="workspace">
        <header className="topbar">
          <div className="topbarIdentity">
            <button className="mobileMenu iconButton" aria-label="Open navigation" title="Open navigation" onClick={() => setMobileNavOpen(true)}><Menu size={19} /></button>
            <div>
              <p className="breadcrumb">ClauseFlow <ChevronRight size={13} /> {viewLabel(view)}</p>
              <h1>{titleFor(view)}</h1>
            </div>
          </div>
          <div className="headerActions">
            <button className="iconButton" aria-label="Refresh on-chain data" title="Refresh on-chain data" onClick={refreshFromChain}><RefreshCcw size={17} className={loading ? "spin" : ""} /></button>
            <button className="walletButton" onClick={handleConnectWallet}><Wallet size={16} /> {walletAddress ? short(walletAddress) : "Connect wallet"}</button>
          </div>
        </header>

        {loadError && <div className="notice errorNotice"><ShieldCheck size={17} /><span>{loadError}</span></div>}
        {loading && <div className="loadingBar" aria-label="Loading Bradbury contract views" />}
        {txState.lifecycle !== "idle" && <TransactionBanner txState={txState} config={config} onDismiss={() => setTxState({ hash: "", label: "No transaction submitted in this browser session.", lifecycle: "idle", executionResult: "NOT_SUBMITTED", consensusResult: "IDLE", message: "Read-only dashboard is available without connecting a wallet.", childTransactions: [] })} />}

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
            openCreate={() => openView("create")}
            openOffers={() => openView("offers")}
            config={config}
            loading={loading}
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
        {view === "deal" && !selectedDeal && <section className="emptyState"><span className="emptyIcon"><Layers3 size={24} /></span><h2>No on-chain deals yet</h2><p>Publish an offer and fund it to start the agreement timeline.</p><button className="primary" onClick={() => openView("offers")}>Browse offers <ArrowRight size={16} /></button></section>}
      </section>
    </main>
  );
}

function Dashboard({ stats, deals, filter, setFilter, builderFilter, setBuilderFilter, clientFilter, setClientFilter, selectDeal, openCreate, openOffers, config, loading }: { stats: Stats | null; deals: Deal[]; filter: string; setFilter: (value: string) => void; builderFilter: string; setBuilderFilter: (value: string) => void; clientFilter: string; setClientFilter: (value: string) => void; selectDeal: (dealId: string) => void; openCreate: () => void; openOffers: () => void; config: ClauseFlowConfig | null; loading: boolean }) {
  const unavailableValue = loading ? "..." : "Unavailable";
  return (
    <div className="dashboardPage pageStack">
      <section className="protocolHero">
        <div className="heroContent">
          <p className="eyebrow">Public agreement ledger</p>
          <h2>Every clause, review, and settlement in one verifiable record.</h2>
          <p>Track funded work from accepted terms to validator-reviewed evidence and final GEN movement.</p>
          <div className="heroActions">
            <button className="primary" onClick={openCreate}><Plus size={16} /> Create offer</button>
            <button className="secondary" onClick={openOffers}>Browse offers <ArrowRight size={16} /></button>
          </div>
        </div>
        <div className="heroProof">
          <span><i /> Live contract</span>
          <strong>{config?.contractAddress ? short(config.contractAddress) : "Not configured"}</strong>
          <small>Canonical history from Bradbury views</small>
        </div>
      </section>

      <section className="statsBand" aria-label="Protocol summary" aria-busy={loading}>
        <Metric icon={<FileText size={18} />} label="Published offers" value={stats?.totalOffers ?? unavailableValue} loading={loading && !stats} />
        <Metric icon={<LockKeyhole size={18} />} label="Funded deals" value={stats?.totalDeals ?? unavailableValue} loading={loading && !stats} />
        <Metric icon={<BadgeCheck size={18} />} label="Completed" value={stats?.completedDeals ?? unavailableValue} loading={loading && !stats} />
        <Metric icon={<CircleDollarSign size={18} />} label="GEN paid" value={stats ? formatGen(stats.totalPaidAtto) : unavailableValue} loading={loading && !stats} />
        <Metric icon={<RefreshCcw size={18} />} label="GEN refunded" value={stats ? formatGen(stats.totalRefundedAtto) : unavailableValue} loading={loading && !stats} />
      </section>

      <section className="ledgerSection">
        <div className="sectionTitle ledgerTitle">
          <div>
            <p className="eyebrow">Agreement history</p>
            <h2>On-chain contracts and payments</h2>
            <p>{loading && deals.length === 0 ? "Reading agreements from Bradbury..." : `${deals.length} agreement${deals.length === 1 ? "" : "s"} match the current view.`}</p>
          </div>
          <div className="filterBox"><Search size={16} /><input aria-label="Search agreements" value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="Search title or address" /></div>
        </div>
        <div className="partyFilters">
          <label><span><Filter size={13} /> Builder address</span><input aria-label="Builder address filter" value={builderFilter} onChange={(event) => setBuilderFilter(event.target.value)} placeholder="0x..." /></label>
          <label><span><Filter size={13} /> Client address</span><input aria-label="Client address filter" value={clientFilter} onChange={(event) => setClientFilter(event.target.value)} placeholder="0x..." /></label>
        </div>
        <div className="ledgerTable">
          <div className="ledgerRow ledgerHead"><span>Agreement</span><span>Parties</span><span>Value</span><span>State</span><span>Last settlement</span><span aria-hidden="true" /></div>
          {deals.map((deal) => (
            <button className="ledgerRow" key={deal.id} onClick={() => selectDeal(deal.id)}>
              <span className="dealIdentity"><small>Deal #{deal.id}</small><strong>{deal.title}</strong></span>
              <span className="partyPair"><span title={deal.builder}>{short(deal.builder)}</span><ArrowRight size={13} /><span title={deal.client}>{short(deal.client)}</span></span>
              <span className="amountCell"><strong>{formatGen(deal.lockedAttoGen)}</strong><small>GEN</small></span>
              <span><Status status={deal.status} /></span>
              <span className="dateCell">{formatDate(deal.completedAt || deal.paidAt || deal.refundedAt)}</span>
              <span className="rowArrow"><ChevronRight size={18} /></span>
            </button>
          ))}
          {deals.length === 0 && !loading && <div className="emptyState compact"><span className="emptyIcon"><ClipboardCheck size={22} /></span><h3>No matching agreements</h3><p>Clear the address filters or publish a new offer to begin.</p></div>}
        </div>
      </section>
    </div>
  );
}

type ExecuteWrite = (label: string, functionName: string, args: CalldataEncodable[], value?: bigint) => Promise<unknown>;

const emptyOfferForm = {
  title: "",
  serviceDescription: "",
  scope: "",
  deliverables: "",
  acceptanceCriteria: "",
  price: "",
  deadlineDays: "",
  revisionRounds: "",
  revisionWindowHours: "",
  gracePeriodHours: "",
  refundRule: "",
  referenceUrls: ""
};

const mochiAgreementForm = {
  title: "Audit and polish Mochi-Game Quest Evaluator demo flow",
  serviceDescription: "Review Mochi-Game and make its Quest Evaluator demo path reviewer-ready.",
  scope: "Audit the live app and README, then deliver public evidence for the Quest Evaluator flow.",
  deliverables: "Live app URL, GitHub repo, README/docs URL, and a delivery note for reviewers.",
  acceptanceCriteria: "Validators can fetch the live app and README and confirm Quest Evaluator, GenLayer consensus, transaction/result UX, and demo checklist.",
  price: "0.02",
  deadlineDays: "3",
  revisionRounds: "1",
  revisionWindowHours: "24",
  gracePeriodHours: "24",
  refundRule: "Client may claim a refund after deadline plus grace period if no valid public evidence is submitted, or after a rejected review.",
  referenceUrls: "https://github.com/tanphung/Mochi-Game\nhttps://mochi-game-frontend.vercel.app"
};

function Offers({ offers, executeWrite }: { offers: Offer[]; executeWrite: ExecuteWrite }) {
  return (
    <div className="offersLayout">
      <section className="offersMain">
        <div className="sectionTitle">
          <div><p className="eyebrow">Ready to fund</p><h2>Published Builder offers</h2><p>Review exact terms before locking GEN.</p></div>
          <span className="countPill">{offers.length} on-chain</span>
        </div>
        <div className="offerList">
          {offers.map((offer) => (
            <article className="offerCard" key={offer.id}>
              <header className="offerHeader">
                <div>
                  <span className="offerNumber">Offer #{offer.id}</span>
                  <h3>{offer.title}</h3>
                  <p className="builderLine"><span className="avatar">{offer.builder.slice(2, 4).toUpperCase()}</span> Builder {short(offer.builder)}</p>
                </div>
                <div className="offerPrice"><strong>{formatGen(offer.priceAttoGen)}</strong><span>GEN</span></div>
              </header>
              <p className="offerScope">{offer.scope}</p>
              <div className="offerTerms">
                <span><Clock3 size={15} /><small>Delivery</small><strong>{offer.deadlineDays} days</strong></span>
                <span><RefreshCcw size={15} /><small>Revisions</small><strong>{offer.revisionRounds} round{offer.revisionRounds === "1" ? "" : "s"}</strong></span>
                <span><ShieldCheck size={15} /><small>Status</small><strong>Open</strong></span>
              </div>
              <OfferClauses value={offer.structuredClauses} />
              <div className="offerFooter">
                <span><LockKeyhole size={15} /> Funds stay in contract escrow</span>
                <button className="primary" onClick={() => void executeWrite("Accept & Lock GEN", "accept_offer", [offer.id], BigInt(offer.priceAttoGen)).catch(() => undefined)}>Accept & Lock {formatGen(offer.priceAttoGen)} GEN <ArrowRight size={16} /></button>
              </div>
            </article>
          ))}
          {offers.length === 0 && <div className="emptyState"><span className="emptyIcon"><FileText size={22} /></span><h3>No published offers</h3><p>The marketplace will show terms here after a Builder publishes an on-chain offer.</p></div>}
        </div>
      </section>
      <aside className="trustRail">
        <div className="trustVisual">
          <span>Protected settlement</span>
          <strong>Terms become executable state.</strong>
        </div>
        <section className="trustSteps">
          <p className="eyebrow">How acceptance works</p>
          <div><span>01</span><p><strong>Read the clauses</strong>Scope, evidence, revisions, and refund rules are fixed before funding.</p></div>
          <div><span>02</span><p><strong>Lock exact GEN</strong>The accepted amount moves into contract-controlled escrow.</p></div>
          <div><span>03</span><p><strong>Verify settlement</strong>ClauseFlow waits for successful execution and refreshed on-chain state.</p></div>
        </section>
      </aside>
    </div>
  );
}

function CreateOffer({ executeWrite, config, walletAddress }: { executeWrite: ExecuteWrite; config: ClauseFlowConfig | null; walletAddress: string }) {
  const [form, setForm] = useState(emptyOfferForm);
  const [draft, setDraft] = useState<StructuredDraft | null>(null);
  const [draftError, setDraftError] = useState("");
  const formError = validateOfferForm(form);
  const setField = (field: keyof typeof form, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
    if (draft) setDraftError("Offer fields changed. Run clause structuring again before publishing.");
    else setDraftError("");
    setDraft(null);
  };
  const loadMochiScenario = () => {
    setForm(mochiAgreementForm);
    setDraft(null);
    setDraftError("");
  };
  const structure = async () => {
    if (formError) throw new Error(formError);
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
    <div className="createPage">
      <ol className="creationSteps" aria-label="Offer creation progress">
        <li className="active"><span>1</span><div><strong>Define</strong><small>Work and terms</small></div></li>
        <li className={draft ? "complete" : ""}><span>2</span><div><strong>Structure</strong><small>GenLayer clauses</small></div></li>
        <li><span>3</span><div><strong>Publish</strong><small>Commit on-chain</small></div></li>
      </ol>
      <div className="createWorkspace">
      <section className="formPanel">
        <div className="formHeading">
          <div><p className="eyebrow">Builder workspace</p><h2>Define the agreement</h2><p>Write what can be verified. The Client will fund these exact terms.</p></div>
          <button className="secondary compactButton" type="button" onClick={loadMochiScenario}><Sparkles size={15} /> Load real example</button>
        </div>
        <fieldset>
          <legend>Service</legend>
          <label className="field full"><span>Offer title <b>Required</b></span><input aria-label="Offer title" placeholder="Audit and polish a real dApp delivery flow" value={form.title} onChange={(event) => setField("title", event.target.value)} /></label>
          <label className="field full"><span>Service description <b>Required</b></span><textarea aria-label="Service description" placeholder="Describe the outcome the Builder will deliver." value={form.serviceDescription} onChange={(event) => setField("serviceDescription", event.target.value)} /></label>
        </fieldset>
        <fieldset>
          <legend>Scope and evidence</legend>
          <label className="field full"><span>Detailed scope <b>Required</b></span><textarea aria-label="Detailed scope" placeholder="Define the work boundaries and what is included." value={form.scope} onChange={(event) => setField("scope", event.target.value)} /></label>
          <label className="field full"><span>Deliverables <b>Required</b></span><textarea aria-label="Deliverables" placeholder="List public app, repository, docs, or other artifacts." value={form.deliverables} onChange={(event) => setField("deliverables", event.target.value)} /></label>
          <label className="field full"><span>Acceptance criteria <b>Required</b></span><textarea aria-label="Acceptance criteria" placeholder="Use objective checks validators can verify from public evidence." value={form.acceptanceCriteria} onChange={(event) => setField("acceptanceCriteria", event.target.value)} /></label>
          <label className="field full"><span>Reference URLs <b>Required</b></span><textarea className="shortTextarea" aria-label="Reference URLs" placeholder={"One public URL per line"} value={form.referenceUrls} onChange={(event) => setField("referenceUrls", event.target.value)} /></label>
        </fieldset>
        <fieldset>
          <legend>Commercial terms</legend>
          <div className="fields commercialFields">
            <label className="field"><span>Price</span><div className="inputWithUnit"><input aria-label="Price in GEN" inputMode="decimal" placeholder="0.02" value={form.price} onChange={(event) => setField("price", event.target.value)} /><em>GEN</em></div></label>
            <label className="field"><span>Deadline</span><div className="inputWithUnit"><input aria-label="Deadline days" inputMode="numeric" placeholder="3" value={form.deadlineDays} onChange={(event) => setField("deadlineDays", event.target.value)} /><em>days</em></div></label>
            <label className="field"><span>Revision rounds</span><input aria-label="Revision rounds" inputMode="numeric" placeholder="1" value={form.revisionRounds} onChange={(event) => setField("revisionRounds", event.target.value)} /></label>
            <label className="field"><span>Revision window</span><div className="inputWithUnit"><input aria-label="Revision window hours" inputMode="numeric" placeholder="24" value={form.revisionWindowHours} onChange={(event) => setField("revisionWindowHours", event.target.value)} /><em>hours</em></div></label>
            <label className="field"><span>Grace period</span><div className="inputWithUnit"><input aria-label="Grace period hours" inputMode="numeric" placeholder="24" value={form.gracePeriodHours} onChange={(event) => setField("gracePeriodHours", event.target.value)} /><em>hours</em></div></label>
          </div>
          <label className="field full"><span>Refund rule <b>Required</b></span><textarea aria-label="Refund rule" placeholder="State exactly when the Client can reclaim escrow." value={form.refundRule} onChange={(event) => setField("refundRule", event.target.value)} /></label>
        </fieldset>
        {formError && <div className="inlineValidation"><CircleDotIcon /> <span>{formError}</span></div>}
        <div className="formActions">
          <span><ShieldCheck size={15} /> Drafting creates a reviewable on-chain clause set.</span>
          <button className="primary" disabled={Boolean(formError)} onClick={() => void structure().catch((error) => setDraftError(normalizeError(error)))}><Sparkles size={16} /> Structure clauses</button>
        </div>
      </section>
      <aside className="draftPanel">
        <div className="draftHeader">
          <div><p className="eyebrow">Agreement preview</p><h2>Structured clauses</h2></div>
          <span className={draft ? "draftState ready" : "draftState"}><i /> {draft ? "Stored on-chain" : "Awaiting draft"}</span>
        </div>
        {draftError && <div className="notice warning"><CircleDotIcon /><span>{draftError}</span></div>}
        {!draft && <div className="documentEmpty">
          <div className="documentGhost"><span /><span /><span /><span /></div>
          <h3>Your executable agreement appears here</h3>
          <p>GenLayer structures the source terms into scope, evidence, payment, revision, and refund clauses. Nothing is published until you review it.</p>
        </div>}
        {draft && <div className="draftClauses contractDocument">
          <div className="documentTitle"><ShieldCheck size={18} /><span><strong>{form.title}</strong><small>ClauseFlow structured agreement</small></span></div>
          <ClauseBlock title="Scope" items={[draft.clauses.scope]} />
          <ClauseBlock title="Deliverables" items={[draft.clauses.deliverables]} />
          {draft.clauses.milestones && <ClauseBlock title="Milestones" items={[draft.clauses.milestones]} />}
          <ClauseBlock title="Acceptance criteria" items={[draft.clauses.acceptanceCriteria]} />
          {draft.clauses.evidenceRequirements && <ClauseBlock title="Evidence requirements" items={[draft.clauses.evidenceRequirements]} />}
          {draft.clauses.verificationPlan && <ClauseBlock title="Validator verification plan" items={[draft.clauses.verificationPlan]} />}
          <ClauseBlock title="Deadline" items={[draft.clauses.deadline]} />
          <ClauseBlock title="Revision rules" items={[draft.clauses.revisionRules]} />
          <ClauseBlock title="Payment" items={[draft.clauses.paymentTerms]} />
          <ClauseBlock title="Refund" items={[draft.clauses.refundConditions]} />
          <p className="draftMeta">Structured {formatDate(draft.structuredAt)} for {short(draft.builder)}</p>
        </div>}
        <div className="publishBar">
          <span>{draft ? "Review complete? Commit this offer to Bradbury." : "Structure the clauses to unlock publishing."}</span>
          <button className="primary wide" disabled={!draft || Boolean(draftError) || Boolean(draft.publishedOfferId)} onClick={() => void publish().catch((error) => setDraftError(normalizeError(error)))}><FileText size={16} /> Publish reviewed offer</button>
        </div>
      </aside>
      </div>
    </div>
  );
}

function DealDetail({ deal, offer, history, txState, executeWrite, config, walletAddress }: { deal: Deal; offer?: Offer; history: HistoryEvent[]; txState: TxState; executeWrite: ExecuteWrite; config: ClauseFlowConfig | null; walletAddress: string }) {
  const [delivery, setDelivery] = useState({ deliveryUrl: "", githubUrl: "", demoUrl: "", documentationUrl: "", deliveryNote: "" });
  const [detailTab, setDetailTab] = useState<"agreement" | "evidence" | "history">("agreement");
  const isBuilder = walletAddress.toLowerCase() === deal.builder.toLowerCase();
  const isClient = walletAddress.toLowerCase() === deal.client.toLowerCase();
  const deliveryError = validateDeliveryForm(delivery);
  const criterionAssessments = parseStoredList<ReviewAssessment>(deal.reviewCriterionAssessments);
  const deliverableAssessments = parseStoredList<ReviewAssessment>(deal.reviewDeliverableAssessments);
  const sourceAssessments = parseStoredList<ReviewSource>(deal.reviewSourceAssessments);
  const reviewStrengths = parseStoredList<string>(deal.reviewStrengths);
  const reviewRisks = parseStoredList<string>(deal.reviewRisks);
  const hasDetailedReview = criterionAssessments.length > 0 || deliverableAssessments.length > 0;
  const loadMochiEvidence = () => setDelivery({
    deliveryUrl: "https://mochi-game-frontend.vercel.app",
    githubUrl: "https://github.com/tanphung/Mochi-Game",
    demoUrl: "https://mochi-game-frontend.vercel.app",
    documentationUrl: "https://github.com/tanphung/Mochi-Game#readme",
    deliveryNote: "Mochi-Game evidence package: live app, GitHub repository, README checklist, and Quest Evaluator flow are public for GenLayer validators to fetch and compare against the accepted agreement."
  });
  return (
    <section className="dealPage">
      <header className="dealHero">
        <div className="dealHeroMain">
          <span className="dealNumber">Agreement CF-{deal.id.padStart(4, "0")}</span>
          <h2>{deal.title}</h2>
          <div className="partyFlow"><span className="avatar">{deal.builder.slice(2, 4).toUpperCase()}</span><span><small>Builder</small><strong>{short(deal.builder)}</strong></span><ArrowRight size={16} /><span className="avatar clientAvatar">{deal.client.slice(2, 4).toUpperCase()}</span><span><small>Client</small><strong>{short(deal.client)}</strong></span></div>
        </div>
        <div className="dealHeroState">
          <Status status={deal.status} />
          <strong>{formatGen(deal.lockedAttoGen)} <small>GEN</small></strong>
          <span>{deal.paid === "true" ? "Settlement released" : deal.refunded === "true" ? "Escrow refunded" : "Contract escrow"}</span>
        </div>
      </header>

      <div className="lifecycle">
        {["FUNDED", "SUBMITTED", "REVIEWED", settlementStep(deal)].map((event, index) => {
          const complete = history.some((item) => item.eventType === event) || deal.status === event;
          return <div className={complete ? "lifecycleStep complete" : "lifecycleStep"} key={event}><span>{complete ? <CheckCircle2 size={15} /> : index + 1}</span><strong>{event.replaceAll("_", " ")}</strong><small>{history.find((item) => item.eventType === event)?.timestamp ? formatDate(history.find((item) => item.eventType === event)?.timestamp || "") : "Awaiting event"}</small></div>;
        })}
      </div>

      <section className="dealFacts">
        <div><Clock3 size={17} /><span><small>Deadline</small><strong>{formatUnix(deal.deadlineAtUnix)}</strong></span></div>
        <div><RefreshCcw size={17} /><span><small>Refund eligibility</small><strong>{formatUnix(deal.refundAvailableAtUnix)}</strong></span></div>
        <div><ShieldCheck size={17} /><span><small>Review decision</small><strong>{deal.reviewResult || "Not reviewed"}</strong></span></div>
      </section>

      <div className="detailTabs" role="tablist" aria-label="Deal detail sections">
        <button role="tab" aria-selected={detailTab === "agreement"} className={detailTab === "agreement" ? "active" : ""} onClick={() => setDetailTab("agreement")}><FileText size={16} /> Agreement</button>
        <button role="tab" aria-selected={detailTab === "evidence"} className={detailTab === "evidence" ? "active" : ""} onClick={() => setDetailTab("evidence")}><ClipboardCheck size={16} /> Evidence & review</button>
        <button role="tab" aria-selected={detailTab === "history"} className={detailTab === "history" ? "active" : ""} onClick={() => setDetailTab("history")}><Activity size={16} /> On-chain history</button>
      </div>

      {detailTab === "agreement" && <div className="agreementTab">
        <section className="agreementDocument">
          <div className="documentTitle"><ShieldCheck size={18} /><span><strong>Accepted agreement</strong><small>Offer #{deal.offerId}, immutable after funding</small></span></div>
          {offer ? <OfferClauses value={offer.structuredClauses} expanded /> : <div className="notice warning"><CircleDotIcon /><span>Accepted clause data is unavailable.</span></div>}
        </section>
        <aside className="settlementPanel">
          <p className="eyebrow">Settlement controls</p>
          <h3>{nextActionTitle(deal)}</h3>
          <p>{deal.nextAction || "Actions unlock only for the correct party and lifecycle state."}</p>
          <div className="settlementAmount"><small>Escrow value</small><strong>{formatGen(deal.lockedAttoGen)} <span>GEN</span></strong></div>
          <div className="actions verticalActions">
            <button className="primary" onClick={() => void executeWrite("Claim Payment", "claim_payment", [deal.id]).catch(() => undefined)} disabled={!isBuilder || deal.status !== "APPROVED"}><LockKeyhole size={16} /> Claim payment</button>
            <button className="secondary" onClick={() => void executeWrite("Claim Refund", "claim_refund", [deal.id]).catch(() => undefined)} disabled={!isClient || !["REJECTED", "FUNDED", "REVISION_REQUIRED"].includes(deal.status)}>Claim refund</button>
            <button className="secondary" onClick={() => void executeWrite("Confirm Payment", "confirm_payment", [deal.id]).catch(() => undefined)} disabled={deal.status !== "PAYMENT_PENDING"}>Confirm payment</button>
            <button className="secondary" onClick={() => void executeWrite("Confirm Refund", "confirm_refund", [deal.id]).catch(() => undefined)} disabled={deal.status !== "REFUND_PENDING"}>Confirm refund</button>
          </div>
          {!walletAddress && <p className="roleHint"><Wallet size={14} /> Connect the participating wallet to unlock eligible actions.</p>}
        </aside>
      </div>}

      {detailTab === "evidence" && <div className="evidenceTab">
        <section className="evidencePanel">
          <div className="sectionTitle"><div><p className="eyebrow">Builder submission</p><h3>Evidence package</h3></div>{deal.submittedAt && <span className="countPill">Submitted {formatDate(deal.submittedAt)}</span>}</div>
          <p className="deliveryNote">{deal.deliveryNote || "No delivery has been submitted."}</p>
          <div className="evidenceLinks">
            <LinkLine label="Delivery" href={deal.deliveryUrl} />
            <LinkLine label="Demo" href={deal.demoUrl} />
            <LinkLine label="Docs" href={deal.documentationUrl} />
            <LinkLine label="GitHub" href={deal.githubUrl} />
          </div>
          {deal.status === "FUNDED" || deal.status === "REVISION_REQUIRED" ? <div className="deliveryForm">
            <div className="deliveryFormHead"><h4>Submit public evidence</h4><button className="secondary compactButton" type="button" onClick={loadMochiEvidence}><Sparkles size={15} /> Load real example</button></div>
            <label className="field"><span>Delivery URL</span><input aria-label="Delivery URL" placeholder="https://your-delivery.app" value={delivery.deliveryUrl} onChange={(event) => setDelivery({ ...delivery, deliveryUrl: event.target.value })} /></label>
            <label className="field"><span>GitHub URL</span><input aria-label="GitHub URL" placeholder="https://github.com/owner/repository" value={delivery.githubUrl} onChange={(event) => setDelivery({ ...delivery, githubUrl: event.target.value })} /></label>
            <label className="field"><span>Demo URL</span><input aria-label="Demo URL" placeholder="https://your-delivery.app/demo" value={delivery.demoUrl} onChange={(event) => setDelivery({ ...delivery, demoUrl: event.target.value })} /></label>
            <label className="field"><span>Documentation URL</span><input aria-label="Documentation URL" placeholder="https://github.com/owner/repository#readme" value={delivery.documentationUrl} onChange={(event) => setDelivery({ ...delivery, documentationUrl: event.target.value })} /></label>
            <label className="field full"><span>Delivery note</span><textarea aria-label="Delivery note" placeholder="Explain where validators can verify each accepted criterion." value={delivery.deliveryNote} onChange={(event) => setDelivery({ ...delivery, deliveryNote: event.target.value })} /></label>
            {deliveryError && <div className="inlineValidation"><CircleDotIcon /><span>{deliveryError}</span></div>}
            <button className="primary" disabled={!isBuilder || Boolean(deliveryError) || !["FUNDED", "REVISION_REQUIRED"].includes(deal.status)} onClick={() => void executeWrite("Submit Delivery", "submit_delivery", [deal.id, delivery.deliveryUrl, delivery.githubUrl, delivery.demoUrl, delivery.documentationUrl, delivery.deliveryNote]).catch(() => undefined)}><GitBranch size={16} /> Submit delivery</button>
          </div> : null}
        </section>
        <section className={`reviewPanel ${deal.reviewResult.toLowerCase()}`}>
          <div className="reviewHeading"><span className="reviewSeal"><ShieldCheck size={23} /></span><div><p className="eyebrow">Validator outcome</p><h3>{humanReviewResult(deal.reviewResult)}</h3></div><strong className="reviewScore">{deal.reviewScore || "0"}<small>/100</small></strong></div>
          <p className="reviewReason">{deal.reviewExecutiveSummary || deal.reviewReason || "Evidence has not been reviewed yet."}</p>
          {deal.reviewConsensusBasis && <div className="consensusNote"><ShieldCheck size={16} /><span><strong>Consensus basis</strong>{deal.reviewConsensusBasis}</span></div>}
          {sourceAssessments.length > 0 ? <ReviewSources sources={sourceAssessments} /> : deal.reviewEvidenceSummary && <div className="reviewBox"><h4>Evidence checked</h4><p>{deal.reviewEvidenceSummary}</p></div>}
          {criterionAssessments.length > 0 && <ReviewAssessments title="Acceptance criteria" assessments={criterionAssessments} />}
          {deliverableAssessments.length > 0 && <ReviewAssessments title="Deliverables" assessments={deliverableAssessments} />}
          {!hasDetailedReview && deal.reviewCriteriaResults && <ClauseBlock title="Criteria results" items={splitLines(deal.reviewCriteriaResults)} />}
          {(reviewStrengths.length > 0 || reviewRisks.length > 0) && <div className="reviewSignals">
            {reviewStrengths.length > 0 && <ClauseBlock title="Verified strengths" items={reviewStrengths} />}
            {reviewRisks.length > 0 && <ClauseBlock title="Risks and gaps" items={reviewRisks} />}
          </div>}
          {deal.reviewMissingItems && <ClauseBlock title="Missing items" items={splitLines(deal.reviewMissingItems)} />}
          {deal.revisionChecklist && <ClauseBlock title="Revision checklist" items={[deal.revisionChecklist]} />}
          <button className="primary wide" onClick={() => void executeWrite("Run Review", "review_delivery", [deal.id]).catch(() => undefined)} disabled={deal.status !== "SUBMITTED"}><Sparkles size={16} /> Run validator review</button>
        </section>
      </div>}

      {detailTab === "history" && <div className="historyTab">
        <section className="historyPanel">
          <div className="sectionTitle"><div><p className="eyebrow">Canonical record</p><h3>Agreement lifecycle</h3></div><span className="countPill">{history.length} events</span></div>
          <div className="historyList">
            {history.map((event, index) => <div key={`${event.eventType}-${index}`}><span className="historyNode"><CheckCircle2 size={15} /></span><div><strong>{event.eventType.replaceAll("_", " ")}</strong><time>{formatDate(event.timestamp)}</time><p>{friendlyHistoryNote(event, deal)}</p><small>Actor {short(event.actor)}</small></div></div>)}
          </div>
        </section>
        <section className="txPanel">
          <div className="sectionTitle"><div><p className="eyebrow">Browser session</p><h3>Transaction proof</h3></div><Status status={txState.lifecycle.toUpperCase()} /></div>
          <dl>
            <dt>Action</dt><dd>{txState.label}</dd>
            <dt>Lifecycle</dt><dd>{txState.lifecycle}</dd>
            <dt>Execution</dt><dd>{txState.executionResult}</dd>
            <dt>Consensus</dt><dd>{txState.consensusResult}</dd>
            <dt>Hash</dt><dd>{txState.hash.startsWith("0x") && config ? <a href={explorerTxUrl(config, txState.hash)} target="_blank" rel="noreferrer">{txState.hash}<ExternalLink size={13} /></a> : txState.hash || "No transaction in this session"}</dd>
          </dl>
          <p>{txState.message}</p>
          {txState.childTransactions.map((hash) => config ? <a className="childTx" key={hash} href={explorerTxUrl(config, hash)} target="_blank" rel="noreferrer">Child GEN transfer {short(hash)} <ExternalLink size={13} /></a> : null)}
        </section>
      </div>}
    </section>
  );
}

function ReviewAssessments({ title, assessments }: { title: string; assessments: ReviewAssessment[] }) {
  return <section className="assessmentSection">
    <div className="assessmentSectionTitle"><h4>{title}</h4><span>{assessments.length} assessed</span></div>
    <div className="assessmentList">
      {assessments.map((assessment) => <article className="assessmentCard" key={assessment.id}>
        <header><span className="assessmentId">{assessment.id}</span><strong>{assessment.criterion}</strong><span className={`assessmentStatus ${assessment.status.toLowerCase()}`}>{assessment.status.replaceAll("_", " ")}</span></header>
        <div className="assessmentBody"><p><b>Finding</b>{assessment.finding}</p><p><b>Validator reasoning</b>{assessment.reasoning}</p></div>
        {(assessment.evidenceUrls || []).length > 0 && <footer>{assessment.evidenceUrls.map((url) => <a href={url} target="_blank" rel="noreferrer" key={url}>{sourceLabel(url)}<ExternalLink size={12} /></a>)}</footer>}
      </article>)}
    </div>
  </section>;
}

function ReviewSources({ sources }: { sources: ReviewSource[] }) {
  return <section className="sourceReview">
    <div className="assessmentSectionTitle"><h4>Evidence sources</h4><span>{sources.filter((source) => source.accessible).length}/{sources.length} accessible</span></div>
    <div className="sourceReviewGrid">
      {sources.map((source) => <article key={`${source.label}-${source.url}`} className={source.accessible ? "accessible" : "unavailable"}>
        <header><strong>{source.label}</strong><span>{source.accessible ? "Fetched" : "Unavailable"}</span></header>
        <p>{source.finding}</p><small>{source.relevance}</small>
        {source.url && <a href={source.url} target="_blank" rel="noreferrer">Open source <ExternalLink size={11} /></a>}
      </article>)}
    </div>
  </section>;
}

function Metric({ icon, label, value, loading = false }: { icon: ReactNode; label: string; value: string; loading?: boolean }) {
  return <div className={`metric${loading ? " metricLoading" : ""}`}><span className="metricIcon">{icon}</span><div><span>{label}</span><strong>{value}</strong></div></div>;
}

function TransactionBanner({ txState, config, onDismiss }: { txState: TxState; config: ClauseFlowConfig | null; onDismiss: () => void }) {
  return <section className={`txToast ${txState.lifecycle}`} aria-live="polite">
    <span className="txToastIcon">{txState.lifecycle === "failed" ? <X size={17} /> : txState.lifecycle === "pending" ? <RefreshCcw className="spin" size={17} /> : <CheckCircle2 size={17} />}</span>
    <div><strong>{txState.label}</strong><p>{txState.message}</p><span>{humanTxState(txState)}</span></div>
    <div className="txToastActions">
      {txState.hash && config ? <a href={explorerTxUrl(config, txState.hash)} target="_blank" rel="noreferrer" aria-label="View transaction" title="View transaction"><ExternalLink size={15} /></a> : null}
      <button className="iconButton" type="button" onClick={onDismiss} aria-label="Dismiss transaction status" title="Dismiss"><X size={15} /></button>
    </div>
  </section>;
}

function ClauseBlock({ title, items }: { title: string; items: string[] }) {
  return <div className="clause"><h3>{title}</h3><ul>{items.map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}</ul></div>;
}

function OfferClauses({ value, expanded = false }: { value: string; expanded?: boolean }) {
  const [isOpen, setIsOpen] = useState(expanded);
  useEffect(() => {
    setIsOpen(expanded);
  }, [expanded, value]);
  const clauses = parseStructuredClauses(value);
  if (!clauses) return <div className="notice warning"><CircleDotIcon /><span>Structured clauses are unavailable for this offer.</span></div>;
  return <details className="offerClauses" open={isOpen} onToggle={(event) => setIsOpen(event.currentTarget.open)}>
    <summary><span>{expanded ? "Full accepted terms" : "Review all clauses"}</span><ChevronRight size={16} /></summary>
    <ClauseBlock title="Scope" items={[clauses.scope]} />
    <ClauseBlock title="Deliverables" items={[clauses.deliverables]} />
    {clauses.milestones && <ClauseBlock title="Milestones" items={splitLines(clauses.milestones)} />}
    <ClauseBlock title="Acceptance criteria" items={[clauses.acceptanceCriteria]} />
    {clauses.evidenceRequirements && <ClauseBlock title="Evidence requirements" items={splitLines(clauses.evidenceRequirements)} />}
    {clauses.verificationPlan && <ClauseBlock title="Validator verification plan" items={splitLines(clauses.verificationPlan)} />}
    <ClauseBlock title="Deadline" items={[clauses.deadline]} />
    <ClauseBlock title="Revision rules" items={[clauses.revisionRules]} />
    <ClauseBlock title="Payment" items={[clauses.paymentTerms]} />
    <ClauseBlock title="Refund" items={[clauses.refundConditions]} />
  </details>;
}

function LinkLine({ label, href }: { label: string; href: string }) {
  return <div className="linkLine"><span>{label}</span>{href ? <a href={href} target="_blank" rel="noreferrer"><span>{displayUrl(href)}</span><ExternalLink size={14} /></a> : <em>Not provided</em>}</div>;
}

function Status({ status }: { status: string }) {
  return <span className={`status ${status.toLowerCase().replaceAll("_", "")}`}><i /> {status.replaceAll("_", " ")}</span>;
}

function CircleDotIcon() {
  return <span className="validationDot" aria-hidden="true" />;
}

function titleFor(view: string) {
  if (view === "offers") return "Published Builder offers";
  if (view === "create") return "Create a ready-to-accept offer";
  if (view === "deal") return "Deal execution detail";
  return "Public on-chain agreement dashboard";
}

function viewLabel(view: string) {
  if (view === "deal") return "Agreement";
  if (view === "create") return "New offer";
  return view.charAt(0).toUpperCase() + view.slice(1);
}

function settlementStep(deal: Deal) {
  if (deal.status === "PAYMENT_PENDING") return "PAYMENT_PENDING";
  if (deal.status === "REFUND_PENDING") return "REFUND_PENDING";
  if (deal.paid === "true") return "PAID";
  if (deal.refunded === "true") return "REFUNDED";
  return "SETTLEMENT";
}

function validateOfferForm(form: typeof emptyOfferForm) {
  const required: Array<[keyof typeof emptyOfferForm, string]> = [
    ["title", "Offer title"],
    ["serviceDescription", "Service description"],
    ["scope", "Scope"],
    ["deliverables", "Deliverables"],
    ["acceptanceCriteria", "Acceptance criteria"],
    ["price", "Price"],
    ["deadlineDays", "Deadline"],
    ["revisionRounds", "Revision rounds"],
    ["revisionWindowHours", "Revision window"],
    ["gracePeriodHours", "Grace period"],
    ["refundRule", "Refund rule"],
    ["referenceUrls", "Reference URLs"]
  ];
  const missing = required.find(([field]) => !form[field].trim());
  if (missing) return `${missing[1]} is required before GenLayer clause structuring.`;
  try {
    const price = parseGen(form.price);
    if (price <= 0n) return "Price must be greater than 0 GEN.";
  } catch (error) {
    return normalizeError(error);
  }
  for (const field of ["deadlineDays", "revisionRounds", "revisionWindowHours", "gracePeriodHours"] as const) {
    if (!/^\d+$/.test(form[field]) || BigInt(form[field]) < 0n) return `${field} must be a whole number.`;
  }
  if (BigInt(form.deadlineDays) <= 0n) return "Deadline must be at least 1 day.";
  if (!hasHttpUrl(form.referenceUrls)) return "Reference URLs must include at least one public http(s) link.";
  return "";
}

function validateDeliveryForm(delivery: { deliveryUrl: string; githubUrl: string; demoUrl: string; documentationUrl: string; deliveryNote: string }) {
  if (!isHttpUrl(delivery.deliveryUrl)) return "Delivery URL must be a public http(s) link.";
  if (delivery.githubUrl && !isHttpUrl(delivery.githubUrl)) return "GitHub URL must be a public http(s) link.";
  if (delivery.demoUrl && !isHttpUrl(delivery.demoUrl)) return "Demo URL must be a public http(s) link.";
  if (delivery.documentationUrl && !isHttpUrl(delivery.documentationUrl)) return "Documentation URL must be a public http(s) link.";
  if (!delivery.deliveryNote.trim()) return "Delivery note is required.";
  return "";
}

function hasHttpUrl(value: string) {
  return value.split(/\s+/).some(isHttpUrl);
}

function isHttpUrl(value: string) {
  return /^https?:\/\/\S+\.\S+/.test(value.trim());
}

function splitLines(value: string) {
  return value.split(/\n|;|•/).map((item) => item.trim()).filter(Boolean);
}

function parseStoredList<T>(value?: string): T[] {
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed as T[] : [];
  } catch {
    return [];
  }
}

function sourceLabel(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "Evidence source";
  }
}

function friendlyHistoryNote(event: HistoryEvent, deal?: Deal) {
  if (event.eventType === "FUNDED") return "Client accepted the offer and locked GEN in contract escrow.";
  if (event.eventType === "SUBMITTED") return "Builder submitted a public delivery evidence package for validator review.";
  if (event.eventType === "PAYMENT_PENDING") return "The contract emitted the Builder payment and is waiting for escrow balance verification.";
  if (event.eventType === "REFUND_PENDING") return "The contract emitted the Client refund and is waiting for escrow balance verification.";
  if (event.eventType === "PAID") return "GEN payment was verified from the contract escrow balance.";
  if (event.eventType === "REFUNDED") return "GEN refund was verified from the contract escrow balance.";
  if (event.eventType === "REVIEWED") {
    try {
      const review = JSON.parse(event.note) as { result?: string; score?: string; reason?: string; evidenceSummary?: string };
      const outcome = humanReviewResult(review.result || "REVIEWED");
      const score = review.score ? ` (${review.score}/100)` : "";
      return `${outcome}${score}. ${review.evidenceSummary || review.reason || "Validators completed the evidence review."}`;
    } catch {
      const outcome = deal?.reviewResult ? humanReviewResult(deal.reviewResult) : "Review completed";
      const score = deal?.reviewScore ? ` (${deal.reviewScore}/100)` : "";
      return `${outcome}${score}. ${deal?.reviewEvidenceSummary || deal?.reviewReason || "Validators stored the material evidence result on-chain."}`;
    }
  }
  return event.note;
}

function humanReviewResult(result: string) {
  if (!result) return "Awaiting review";
  if (result === "APPROVED") return "Approved";
  if (result === "REVISION_REQUIRED") return "Revision required";
  if (result === "REJECTED") return "Rejected";
  return result.replaceAll("_", " ").toLowerCase().replace(/^\w/, (letter) => letter.toUpperCase());
}

function nextActionTitle(deal: Deal) {
  if (deal.status === "APPROVED") return "Payment is ready to claim";
  if (deal.status === "PAYMENT_PENDING") return "Verify the emitted payment";
  if (deal.status === "REFUND_PENDING") return "Verify the emitted refund";
  if (deal.status === "PAID") return "Agreement settled";
  if (deal.status === "REFUNDED") return "Escrow returned";
  if (deal.status === "SUBMITTED") return "Evidence is ready for review";
  if (deal.status === "REVISION_REQUIRED") return "Revision evidence is required";
  if (deal.status === "REJECTED") return "Refund may be available";
  return "Delivery is in progress";
}

function humanTxState(txState: TxState) {
  if (txState.lifecycle === "pending") return "Waiting for validator consensus";
  if (txState.lifecycle === "failed") return "Transaction did not change contract state";
  if (txState.lifecycle === "accepted" || txState.lifecycle === "finalized") return "Execution verified on-chain";
  return "No transaction submitted";
}

function displayUrl(value: string) {
  try {
    const url = new URL(value);
    return `${url.hostname}${url.pathname === "/" ? "" : url.pathname}`;
  } catch {
    return value;
  }
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
