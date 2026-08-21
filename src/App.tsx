import {
  Activity,
  Archive,
  ArrowRight,
  BadgeCheck,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  ClipboardCheck,
  Clock3,
  ExternalLink,
  FileCheck2,
  FileText,
  Filter,
  Fingerprint,
  GitBranch,
  Hash,
  Landmark,
  LockKeyhole,
  Menu,
  Plus,
  RefreshCcw,
  Search,
  ShieldCheck,
  Sparkles,
  Trash2,
  Wallet,
  X
} from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { CalldataEncodable } from "genlayer-js/types";
import {
  connectWallet,
  createReadClient,
  discoverWalletProviders,
  explorerAddressUrl,
  explorerTxUrl,
  hasContractAddress,
  normalizeError,
  readJsonView,
  readRouterSettlement,
  releaseRouterSettlement,
  writeAndVerify,
  type ClauseFlowConfig,
  type RouterSettlement,
  type WalletOption,
  type WalletProvider
} from "./lib/genlayer";
import bundledOnChainSnapshot from "./data/onchain-snapshot.json";

type DealStatus = "FUNDED" | "SUBMITTED" | "APPROVED" | "REVISION_REQUIRED" | "REJECTED" | "PAYMENT_PENDING" | "REFUND_PENDING" | "PAID" | "REFUNDED";
type View = "dashboard" | "offers" | "create" | "deal";
type EvidenceType = "DELIVERY" | "DEMO" | "DOCUMENTATION" | "SOURCE" | "AUDIT" | "OTHER";
type VersionKind = "GIT_COMMIT" | "IPFS_CID" | "VERCEL_DEPLOYMENT";

type Obligation = {
  id: string;
  category: "SCOPE" | "DELIVERABLE" | "ACCEPTANCE" | "EVIDENCE";
  statement: string;
  acceptanceRule: string;
  requiredEvidenceTypes: EvidenceType[];
};

type EvidenceSource = {
  id: string;
  type: EvidenceType;
  label: string;
  url: string;
  versionKind: VersionKind;
  versionId: string;
  sha256: string;
};

type EvidenceRound = {
  round: string;
  submittedAt: string;
  manifest: EvidenceSource[];
  manifestHash: string;
  deliveryNote: string;
};

type ObligationAssessment = {
  obligationId: string;
  category?: string;
  statement: string;
  acceptanceRule?: string;
  requiredEvidenceTypes?: string[];
  status: "SATISFIED" | "PARTIAL" | "NOT_SATISFIED" | "UNVERIFIABLE";
  finding: string;
  reasoning: string;
  evidenceIds: string[];
};

type ReviewSource = {
  id?: string;
  type?: string;
  label: string;
  url: string;
  accessible: boolean;
  versionMatched?: boolean;
  versionKind?: string;
  versionId?: string;
  expectedSha256?: string;
  actualSha256?: string;
  error?: string;
  finding?: string;
  relevance?: string;
};

type Offer = {
  id: string;
  title: string;
  serviceDescription?: string;
  builder: string;
  priceAttoGen: string;
  status: string;
  protocolVersion?: string;
  obligations?: string;
  obligationsHash?: string;
  deliveryWindowHours?: string;
  gracePeriodHours?: string;
  revisionRounds: string;
  revisionWindowHours?: string;
  reviewWindowHours?: string;
  refundPolicy?: string;
  scope?: string;
  deliverables?: string;
  acceptanceCriteria?: string;
  refundRule?: string;
  structuredClauses?: string;
  deadlineDays?: string;
};

type Deal = {
  id: string;
  offerId: string;
  title: string;
  serviceDescription?: string;
  builder: string;
  client: string;
  lockedAttoGen: string;
  status: DealStatus;
  protocolVersion?: string;
  obligations?: string;
  obligationsHash?: string;
  deliveryWindowHours?: string;
  gracePeriodHours?: string;
  maxRevisions?: string;
  revisionWindowHours?: string;
  reviewWindowHours?: string;
  revisionCount?: string;
  submissionRound?: string;
  fundedAt: string;
  submittedAt: string;
  reviewedAt: string;
  completedAt: string;
  paidAt: string;
  refundedAt: string;
  deliveryDueAtUnix?: string;
  initialRefundAtUnix?: string;
  revisionDueAtUnix?: string;
  reviewDueAtUnix?: string;
  deadlineAtUnix?: string;
  refundAvailableAtUnix?: string;
  currentEvidenceManifest?: string;
  currentEvidenceHash?: string;
  currentDeliveryNote?: string;
  reviewResult: string;
  reviewScore: string;
  reviewExecutiveSummary?: string;
  reviewObligationAssessments?: string;
  reviewSourceAssessments?: string;
  reviewStrengths?: string;
  reviewRisks?: string;
  reviewMissingItems?: string;
  reviewRevisionChecklist?: string;
  reviewConsensusBasis?: string;
  settlementId?: string;
  settlementKind?: string;
  settlementRecipient?: string;
  settlementAmountAtto?: string;
  settlementConfirmedAt?: string;
  paid: string;
  refunded: string;
  nextAction: string;
  deliveryUrl?: string;
  githubUrl?: string;
  demoUrl?: string;
  documentationUrl?: string;
  deliveryNote?: string;
  reviewReason?: string;
  revisionChecklist?: string;
  reviewCriterionAssessments?: string;
  reviewDeliverableAssessments?: string;
  reviewEvidenceSummary?: string;
};

type HistoryEvent = { eventType: string; note: string; timestamp: string; actor: string };
type Stats = {
  protocolVersion?: string;
  totalOffers: string;
  totalDeals: string;
  activeDeals: string;
  completedDeals: string;
  pendingSettlements?: string;
  totalFundedAtto: string;
  totalPaidAtto: string;
  totalRefundedAtto: string;
  contractBalanceAtto: string;
  accountedEscrowAtto: string;
  settlementRouter?: string;
};
type RefundEligibility = { eligible: boolean; reason: string };

type TxState = {
  hash: string;
  label: string;
  lifecycle: "idle" | "pending" | "accepted" | "finalized" | "failed";
  executionResult: string;
  consensusResult: string;
  message: string;
  childTransactions: string[];
};

type DashboardSnapshot = {
  version: number;
  network: ClauseFlowConfig["chain"];
  contractAddress: string;
  protocolVersion?: ClauseFlowConfig["protocolVersion"];
  settlementRouter?: string;
  offers: Offer[];
  deals: Deal[];
  stats: Stats;
  histories: Record<string, HistoryEvent[]>;
  generatedAt: string;
};

const CACHE_PREFIX = "clauseflow:dashboard:";
const EMPTY_TX: TxState = {
  hash: "",
  label: "No transaction submitted in this browser session.",
  lifecycle: "idle",
  executionResult: "NOT_SUBMITTED",
  consensusResult: "IDLE",
  message: "Public agreement records are available without connecting a wallet.",
  childTransactions: []
};

function runtimeConfig(): ClauseFlowConfig {
  const configured = (window as unknown as { CLAUSEFLOW_CONFIG?: ClauseFlowConfig }).CLAUSEFLOW_CONFIG || {
    contractAddress: "",
    chain: "testnetBradbury",
    explorerUrl: "https://explorer-bradbury.genlayer.com",
    stateStatus: "accepted",
    protocolVersion: "v2"
  };
  const localContract = ["localhost", "127.0.0.1", "::1"].includes(window.location.hostname)
    ? new URLSearchParams(window.location.search).get("contract")
    : "";
  return localContract && /^0x[a-fA-F0-9]{40}$/.test(localContract)
    ? { ...configured, contractAddress: localContract }
    : configured;
}

function readSnapshot(config: ClauseFlowConfig): DashboardSnapshot | null {
  if (!hasContractAddress(config)) return null;
  const candidates: unknown[] = [];
  try {
    const cached = window.localStorage.getItem(`${CACHE_PREFIX}${config.contractAddress.toLowerCase()}`);
    if (cached) candidates.push(JSON.parse(cached));
  } catch {
    // Snapshot caching is optional.
  }
  candidates.push(bundledOnChainSnapshot);
  for (const candidate of candidates) {
    const snapshot = candidate as DashboardSnapshot;
    const v2IdentityMatches = config.protocolVersion !== "v2" || (
      snapshot.protocolVersion === "v2"
      && Boolean(config.settlementRouter)
      && snapshot.settlementRouter?.toLowerCase() === config.settlementRouter?.toLowerCase()
    );
    if (
      snapshot
      && [1, 2].includes(snapshot.version)
      && snapshot.network === config.chain
      && snapshot.contractAddress?.toLowerCase() === config.contractAddress.toLowerCase()
      && v2IdentityMatches
      && Array.isArray(snapshot.deals)
      && Array.isArray(snapshot.offers)
      && snapshot.stats
    ) return snapshot;
  }
  return null;
}

function storeSnapshot(config: ClauseFlowConfig, offers: Offer[], deals: Deal[], stats: Stats, histories: Record<string, HistoryEvent[]>) {
  try {
    window.localStorage.setItem(`${CACHE_PREFIX}${config.contractAddress.toLowerCase()}`, JSON.stringify({
      version: 2,
      network: config.chain,
      contractAddress: config.contractAddress,
      protocolVersion: config.protocolVersion,
      settlementRouter: config.settlementRouter,
      offers,
      deals,
      stats,
      histories,
      generatedAt: new Date().toISOString()
    }));
  } catch {
    // The live contract remains the source of truth when storage is unavailable.
  }
}

export function App() {
  const rootConfig = useMemo(runtimeConfig, []);
  const profiles = useMemo(() => [rootConfig, ...(rootConfig.archives || [])], [rootConfig]);
  const [profileIndex, setProfileIndex] = useState(0);
  const config = profiles[profileIndex] || rootConfig;
  const initialSnapshot = readSnapshot(config);
  const [view, setView] = useState<View>("dashboard");
  const [offers, setOffers] = useState<Offer[]>(initialSnapshot?.offers || []);
  const [deals, setDeals] = useState<Deal[]>(initialSnapshot?.deals || []);
  const [stats, setStats] = useState<Stats | null>(initialSnapshot?.stats || null);
  const [histories, setHistories] = useState<Record<string, HistoryEvent[]>>(initialSnapshot?.histories || {});
  const [evidenceRounds, setEvidenceRounds] = useState<Record<string, EvidenceRound[]>>({});
  const [selectedDealId, setSelectedDealId] = useState(initialSnapshot?.deals[0]?.id || "");
  const [loading, setLoading] = useState(!initialSnapshot);
  const [refreshing, setRefreshing] = useState(Boolean(initialSnapshot));
  const [live, setLive] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [syncedAt, setSyncedAt] = useState(initialSnapshot?.generatedAt || "");
  const [filter, setFilter] = useState("");
  const [builderFilter, setBuilderFilter] = useState("");
  const [clientFilter, setClientFilter] = useState("");
  const [walletAddress, setWalletAddress] = useState("");
  const [walletName, setWalletName] = useState("");
  const [walletProvider, setWalletProvider] = useState<WalletProvider | null>(null);
  const [walletOptions, setWalletOptions] = useState<WalletOption[]>([]);
  const [walletPickerOpen, setWalletPickerOpen] = useState(false);
  const [walletConnecting, setWalletConnecting] = useState(false);
  const [navigationOpen, setNavigationOpen] = useState(false);
  const [walletError, setWalletError] = useState("");
  const [txState, setTxState] = useState<TxState>(EMPTY_TX);
  const [routerReceipt, setRouterReceipt] = useState<RouterSettlement | null>(null);
  const [refundEligibility, setRefundEligibility] = useState<RefundEligibility | null>(null);
  const refreshLock = useRef(false);

  const selectedDeal = deals.find((deal) => deal.id === selectedDealId) || deals[0];
  const selectedOffer = selectedDeal ? offers.find((offer) => offer.id === selectedDeal.offerId) : undefined;
  const filteredDeals = useMemo(() => deals.filter((deal) => {
    const query = filter.trim().toLowerCase();
    return (!query || `${deal.title} ${deal.builder} ${deal.client}`.toLowerCase().includes(query))
      && (!builderFilter || deal.builder.toLowerCase().includes(builderFilter.toLowerCase()))
      && (!clientFilter || deal.client.toLowerCase().includes(clientFilter.toLowerCase()));
  }), [builderFilter, clientFilter, deals, filter]);

  useEffect(() => {
    const snapshot = readSnapshot(config);
    setOffers(snapshot?.offers || []);
    setDeals(snapshot?.deals || []);
    setStats(snapshot?.stats || null);
    setHistories(snapshot?.histories || {});
    setEvidenceRounds({});
    setSelectedDealId(snapshot?.deals[0]?.id || "");
    setLive(false);
    setLoading(!snapshot);
    setRefreshing(Boolean(snapshot));
    setLoadError("");
    setRouterReceipt(null);
    setRefundEligibility(null);
    void refreshDashboard(config);
  }, [config.contractAddress]);

  useEffect(() => {
    if (view === "offers" || view === "deal") void refreshOffers(config);
    if (view === "deal" && selectedDeal) void refreshDealExtras(config, selectedDeal);
  }, [view, selectedDeal?.id, selectedDeal?.status, config.contractAddress]);

  useEffect(() => {
    if (!walletProvider?.on) return;
    const accountsChanged = (...args: unknown[]) => {
      const accounts = Array.isArray(args[0]) ? args[0] as string[] : [];
      setWalletAddress(accounts[0] || "");
      if (!accounts[0]) setWalletName("");
    };
    const disconnected = () => {
      setWalletAddress("");
      setWalletName("");
      setWalletProvider(null);
    };
    walletProvider.on("accountsChanged", accountsChanged);
    walletProvider.on("disconnect", disconnected);
    return () => {
      walletProvider.removeListener?.("accountsChanged", accountsChanged);
      walletProvider.removeListener?.("disconnect", disconnected);
    };
  }, [walletProvider]);

  async function refreshDashboard(cfg = config) {
    if (refreshLock.current || !hasContractAddress(cfg)) return;
    refreshLock.current = true;
    if (deals.length === 0) setLoading(true);
    setRefreshing(true);
    setLoadError("");
    try {
      const client = createReadClient(cfg);
      const [ids, nextStats] = await Promise.all([
        readJsonView<string[]>(client, cfg, "get_deal_ids", []),
        readJsonView<Stats>(client, cfg, "get_dashboard_stats", [])
      ]);
      const nextDeals = await Promise.all(ids.map((id) => readJsonView<Deal>(client, cfg, "get_deal", [id])));
      setDeals(nextDeals);
      setStats(nextStats);
      setSelectedDealId((current) => nextDeals.some((deal) => deal.id === current) ? current : nextDeals[0]?.id || "");
      setLive(true);
      setSyncedAt(new Date().toISOString());
      storeSnapshot(cfg, offers, nextDeals, nextStats, histories);
    } catch (error) {
      setLoadError(`Latest Bradbury read failed: ${normalizeError(error)}`);
    } finally {
      refreshLock.current = false;
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function refreshOffers(cfg = config) {
    if (!hasContractAddress(cfg)) return;
    try {
      const client = createReadClient(cfg);
      const ids = await readJsonView<string[]>(client, cfg, "get_offer_ids", []);
      const nextOffers = await Promise.all(ids.map((id) => readJsonView<Offer>(client, cfg, "get_offer", [id])));
      setOffers(nextOffers);
      if (stats) storeSnapshot(cfg, nextOffers, deals, stats, histories);
    } catch (error) {
      setLoadError(`Could not load offers: ${normalizeError(error)}`);
    }
  }

  async function refreshDealExtras(cfg: ClauseFlowConfig, deal: Deal) {
    try {
      const client = createReadClient(cfg);
      const historyPromise = readJsonView<HistoryEvent[]>(client, cfg, "get_deal_history", [deal.id]);
      const roundsPromise = cfg.protocolVersion === "v2"
        ? readJsonView<EvidenceRound[]>(client, cfg, "get_evidence_rounds", [deal.id])
        : Promise.resolve([]);
      const refundPromise = cfg.protocolVersion === "v2"
        ? readJsonView<RefundEligibility>(client, cfg, "get_refund_eligibility", [deal.id])
        : Promise.resolve(null);
      const [history, rounds, eligibility] = await Promise.all([historyPromise, roundsPromise, refundPromise]);
      setHistories((current) => ({ ...current, [deal.id]: history }));
      setEvidenceRounds((current) => ({ ...current, [deal.id]: rounds }));
      setRefundEligibility(eligibility);
      if (deal.settlementId && cfg.settlementRouter) {
        setRouterReceipt(await readRouterSettlement(cfg, deal.settlementId));
      } else {
        setRouterReceipt(null);
      }
    } catch (error) {
      setLoadError(`Could not load agreement detail: ${normalizeError(error)}`);
    }
  }

  async function connectUsingWallet(option: WalletOption) {
    setWalletPickerOpen(false);
    setWalletConnecting(true);
    setWalletError("");
    try {
      const connected = await connectWallet(config, option.provider);
      setWalletAddress(connected.address);
      setWalletName(option.name);
      setWalletProvider(option.provider);
      window.localStorage.setItem("clauseflow:wallet-rdns", option.rdns || option.id);
    } catch (error) {
      setWalletError(normalizeError(error));
    } finally {
      setWalletConnecting(false);
    }
  }

  async function handleConnectWallet() {
    setWalletConnecting(true);
    setWalletError("");
    try {
      const options = await discoverWalletProviders();
      if (options.length === 0) throw new Error("No compatible EVM wallet was found. Install OKX Wallet, MetaMask, or another EIP-6963 wallet.");
      setWalletOptions(options);
      if (options.length === 1) await connectUsingWallet(options[0]);
      else setWalletPickerOpen(true);
    } catch (error) {
      setWalletError(normalizeError(error));
    } finally {
      setWalletConnecting(false);
    }
  }

  async function executeWrite(label: string, functionName: string, args: CalldataEncodable[], value = 0n) {
    if (config.readOnly) throw new Error("Archived contracts are read-only.");
    setTxState({ ...EMPTY_TX, label, lifecycle: "pending", executionResult: "WAITING_FOR_SIGNATURE", message: "Confirm this transaction in your wallet." });
    try {
      const result = await writeAndVerify(config, functionName, args, value, (hash) => {
        setTxState({ hash, label, lifecycle: "pending", executionResult: "WAITING_FOR_CONSENSUS", consensusResult: "PENDING", message: "Submitted to GenLayer validators.", childTransactions: [] });
      }, walletProvider || undefined);
      setWalletAddress(result.address);
      setTxState({
        hash: result.hash,
        label,
        lifecycle: result.lifecycle === "FINALIZED" ? "finalized" : "accepted",
        executionResult: result.executionResult,
        consensusResult: result.consensusResult,
        message: result.childTransactions.length
          ? "Parent execution succeeded. The finalized child settlement must still be verified."
          : "Execution succeeded and the contract state is being refreshed.",
        childTransactions: result.childTransactions
      });
      await refreshDashboard();
      return result;
    } catch (error) {
      const message = normalizeError(error);
      setTxState((current) => ({ ...current, label, lifecycle: "failed", executionResult: "FAILED", message }));
      throw error;
    }
  }

  async function releaseSettlement(deal: Deal) {
    if (!walletProvider || !walletAddress) throw new Error("Connect the settlement recipient wallet first.");
    if (!deal.settlementId) throw new Error("This deal has no settlement ID.");
    setTxState({ ...EMPTY_TX, label: "Release Router Settlement", lifecycle: "pending", executionResult: "WAITING_FOR_EVM_RECEIPT", message: "Confirm the router release in the recipient wallet." });
    try {
      const hash = await releaseRouterSettlement(config, walletProvider, walletAddress, deal.settlementId);
      setTxState({ hash, label: "Release Router Settlement", lifecycle: "finalized", executionResult: "EVM_RECEIPT_SUCCESS", consensusResult: "NOT_APPLICABLE", message: "Router released the exact settlement to its bound recipient. Confirm it on ClauseFlow next.", childTransactions: [] });
      await refreshDealExtras(config, deal);
    } catch (error) {
      setTxState({ ...EMPTY_TX, label: "Release Router Settlement", lifecycle: "failed", executionResult: "FAILED", message: normalizeError(error) });
      throw error;
    }
  }

  function openDeal(id: string) {
    setSelectedDealId(id);
    setView("deal");
    setNavigationOpen(false);
  }

  function navigate(nextView: View) {
    setView(nextView);
    setNavigationOpen(false);
  }

  return <div className="appShell">
    {refreshing && <div className="loadingBar" />}
    <aside className={`sidebar ${navigationOpen ? "open" : ""}`}>
      <div className="brand"><span className="brandMark"><ShieldCheck size={21} /></span><span className="brandCopy"><strong>ClauseFlow</strong><small>Agreement protocol v2</small></span><button className="iconButton mobileClose" onClick={() => setNavigationOpen(false)} aria-label="Close navigation"><X size={16} /></button></div>
      <nav>
        <p className="navLabel">Workspace</p>
        <NavButton active={view === "dashboard"} icon={<Activity size={16} />} label="Dashboard" onClick={() => navigate("dashboard")} />
        <NavButton active={view === "offers"} icon={<FileText size={16} />} label="Offers" onClick={() => navigate("offers")} />
        <NavButton active={view === "create"} icon={<Plus size={16} />} label="New offer" onClick={() => navigate("create")} disabled={Boolean(config.readOnly)} />
        <NavButton active={view === "deal"} icon={<LockKeyhole size={16} />} label="Deal detail" onClick={() => navigate("deal")} disabled={!selectedDeal} />
        {profiles.length > 1 && <>
          <p className="navLabel archiveLabel">Contract history</p>
          {profiles.map((profile, index) => <NavButton
            key={profile.contractAddress}
            active={profileIndex === index}
            icon={index === 0 ? <BadgeCheck size={16} /> : <Archive size={16} />}
            label={profile.label || (index === 0 ? "Current v2" : `Archived v${index}`)}
            onClick={() => { setProfileIndex(index); navigate("dashboard"); }}
          />)}
        </>}
      </nav>
      <div className="sidebarProof"><span className="proofIcon"><Landmark size={16} /></span><div><span className="networkState"><i /> Bradbury testnet</span><strong>{short(config.contractAddress)}</strong></div><a href={explorerAddressUrl(config, config.contractAddress)} target="_blank" rel="noreferrer" title="Open contract"><ExternalLink size={15} /></a></div>
    </aside>
    {navigationOpen && <button className="sidebarScrim" onClick={() => setNavigationOpen(false)} aria-label="Close navigation" />}

    <main className="workspace">
      <header className="topbar">
        <div className="topbarIdentity"><button className="iconButton mobileMenu" onClick={() => setNavigationOpen(true)} aria-label="Open navigation"><Menu size={17} /></button><div><div className="breadcrumb">ClauseFlow <ChevronRight size={12} /> {viewLabel(view)}</div><h1>{titleFor(view)}</h1></div></div>
        <div className="headerActions">
          <button className="iconButton" onClick={() => void refreshDashboard()} title="Refresh on-chain data" aria-label="Refresh on-chain data"><RefreshCcw className={refreshing ? "spin" : ""} size={16} /></button>
          <button className="walletButton" onClick={() => void handleConnectWallet()} disabled={walletConnecting}><Wallet size={16} /> {walletAddress ? short(walletAddress) : walletConnecting ? "Connecting" : "Connect wallet"}</button>
        </div>
      </header>

      <div className={`syncBanner ${loadError ? "warning" : ""}`}>
        {loadError ? <ShieldCheck size={15} /> : <CheckCircle2 size={15} />}
        <span><strong>{loadError ? "Snapshot retained" : live ? "Live on-chain data synced" : initialSnapshot ? "Verified on-chain snapshot - syncing latest data" : "Reading Bradbury state"}</strong>{syncedAt && <small>{formatDate(syncedAt)}</small>}</span>
      </div>
      {config.readOnly && <div className="archiveBanner"><Archive size={17} /><span><strong>Archived v1 pilot</strong>This contract is preserved for historical transparency. All write actions are disabled and its records are not mixed with v2.</span></div>}
      {walletError && <div className="notice warning"><ShieldCheck size={15} /><span>{walletError}</span></div>}

      {view === "dashboard" && <Dashboard stats={stats} deals={filteredDeals} loading={loading} config={config} filter={filter} setFilter={setFilter} builderFilter={builderFilter} setBuilderFilter={setBuilderFilter} clientFilter={clientFilter} setClientFilter={setClientFilter} openDeal={openDeal} openCreate={() => setView("create")} openOffers={() => setView("offers")} />}
      {view === "offers" && <Offers offers={offers} config={config} executeWrite={executeWrite} />}
      {view === "create" && <CreateOffer config={config} walletAddress={walletAddress} executeWrite={executeWrite} />}
      {view === "deal" && selectedDeal && <DealDetail
        deal={selectedDeal}
        offer={selectedOffer}
        history={histories[selectedDeal.id] || []}
        evidenceRounds={evidenceRounds[selectedDeal.id] || []}
        config={config}
        walletAddress={walletAddress}
        routerReceipt={routerReceipt}
        refundEligibility={refundEligibility}
        txState={txState}
        executeWrite={executeWrite}
        releaseSettlement={releaseSettlement}
        refreshExtras={() => refreshDealExtras(config, selectedDeal)}
      />}
      {view === "deal" && !selectedDeal && <EmptyState title="No funded agreements yet" body="Accept a published offer to create an immutable agreement record." />}
    </main>

    {walletPickerOpen && <div className="walletPickerScrim" role="dialog" aria-modal="true" aria-label="Choose wallet"><section className="walletPicker"><header><div><p className="eyebrow">Wallet connection</p><h2>Choose a wallet</h2></div><button className="iconButton" onClick={() => setWalletPickerOpen(false)} aria-label="Close"><X size={16} /></button></header><div className="walletOptions">{walletOptions.map((option) => <button className="walletOption" key={option.id} onClick={() => void connectUsingWallet(option)}>{option.icon ? <img src={option.icon} alt="" /> : <span className="walletFallback"><Wallet size={18} /></span>}<span><strong>{option.name}</strong><small>{option.rdns || "Injected EVM wallet"}</small></span><ChevronRight size={16} /></button>)}</div></section></div>}
    {txState.lifecycle !== "idle" && <TransactionBanner txState={txState} config={config} onDismiss={() => setTxState(EMPTY_TX)} />}
  </div>;
}

type ExecuteWrite = (label: string, functionName: string, args: CalldataEncodable[], value?: bigint) => Promise<unknown>;

function NavButton({ active, icon, label, onClick, disabled = false }: { active: boolean; icon: ReactNode; label: string; onClick: () => void; disabled?: boolean }) {
  return <button className={active ? "active" : ""} onClick={onClick} disabled={disabled}>{icon}{label}</button>;
}

function Dashboard({ stats, deals, loading, config, filter, setFilter, builderFilter, setBuilderFilter, clientFilter, setClientFilter, openDeal, openCreate, openOffers }: {
  stats: Stats | null; deals: Deal[]; loading: boolean; config: ClauseFlowConfig; filter: string; setFilter: (value: string) => void;
  builderFilter: string; setBuilderFilter: (value: string) => void; clientFilter: string; setClientFilter: (value: string) => void;
  openDeal: (id: string) => void; openCreate: () => void; openOffers: () => void;
}) {
  return <div className="pageStack">
    <section className="protocolHero"><div className="heroContent"><p className="eyebrow">Evidence-bound service escrow</p><h2>Every obligation, review, and settlement in one verifiable record.</h2><p>GenLayer validators independently refetch immutable evidence and adjudicate every accepted obligation before GEN can move.</p><div className="heroActions"><button className="primary" onClick={openCreate} disabled={Boolean(config.readOnly)}><Plus size={16} /> Create offer</button><button className="secondary" onClick={openOffers}>Browse offers <ArrowRight size={15} /></button></div></div><div className="heroProof"><span><i /> {config.readOnly ? "Archived contract" : "Current v2 contract"}</span><strong>{short(config.contractAddress)}</strong><small>{config.protocolVersion === "v2" ? "Exact receipt settlement" : "Historical balance-confirmed pilot"}</small></div></section>
    <section className="statsBand">
      <Metric icon={<FileText size={17} />} label="Published offers" value={stats?.totalOffers || "0"} loading={loading} />
      <Metric icon={<LockKeyhole size={17} />} label="Active deals" value={stats?.activeDeals || "0"} loading={loading} />
      <Metric icon={<BadgeCheck size={17} />} label="Completed" value={stats?.completedDeals || "0"} loading={loading} />
      <Metric icon={<CircleDollarSign size={17} />} label="GEN paid" value={formatGen(stats?.totalPaidAtto || "0")} loading={loading} />
      <Metric icon={<RefreshCcw size={17} />} label="GEN refunded" value={formatGen(stats?.totalRefundedAtto || "0")} loading={loading} />
    </section>
    <section className="lifecycleBand"><div className="lifecycleHeading"><p className="eyebrow">Enforced lifecycle</p><h2>Accepted terms cannot outrun settlement logic</h2></div><ol>{[
      ["01", "Publish obligations", "Every binding promise gets a stable ID and acceptance rule."],
      ["02", "Fund exactly", "The Client locks the displayed GEN against an immutable manifest."],
      ["03", "Version evidence", "The Builder submits commit/CID/deployment URLs with SHA-256."],
      ["04", "Reach consensus", "Validators refetch sources and adjudicate every obligation."],
      ["05", "Enforce terms", "Revision, timeout, and refund windows execute deterministically."],
      ["06", "Match receipt", "Terminal state requires the exact deal and recipient receipt."]
    ].map(([number, title, copy]) => <li key={number}><span>{number}</span><p><strong>{title}</strong>{copy}</p></li>)}</ol></section>
    <section className="ledgerSection"><div className="sectionTitle ledgerTitle"><div><p className="eyebrow">Agreement history</p><h2>On-chain contracts and settlements</h2><p>{deals.length} agreements match the current view.</p></div><label className="filterBox"><Search size={15} /><input value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="Search title or address" /></label></div><div className="partyFilters"><label><span><Filter size={12} /> Builder address</span><input value={builderFilter} onChange={(event) => setBuilderFilter(event.target.value)} placeholder="0x..." /></label><label><span><Filter size={12} /> Client address</span><input value={clientFilter} onChange={(event) => setClientFilter(event.target.value)} placeholder="0x..." /></label></div>{deals.length ? <div className="ledgerTable"><div className="ledgerRow ledgerHead"><span>Agreement</span><span>Parties</span><span>Value</span><span>State</span><span>Last settlement</span><span /></div>{deals.map((deal) => <button className="ledgerRow" key={deal.id} onClick={() => openDeal(deal.id)}><span className="dealIdentity"><small>Deal #{deal.id}</small><strong>{deal.title}</strong></span><span className="partyPair">{short(deal.builder)} <ArrowRight size={11} /> {short(deal.client)}</span><span className="amountCell"><strong>{formatGen(deal.lockedAttoGen)}</strong><small>GEN</small></span><Status status={deal.status} /><span className="dateCell">{formatDate(deal.completedAt || deal.reviewedAt || deal.fundedAt)}</span><ChevronRight className="rowArrow" size={16} /></button>)}</div> : <EmptyState title="No agreements on this contract" body={config.readOnly ? "This archive contains no matching records." : "Publish and fund an offer to create the first v2 agreement."} />}</section>
  </div>;
}

function Offers({ offers, config, executeWrite }: { offers: Offer[]; config: ClauseFlowConfig; executeWrite: ExecuteWrite }) {
  return <div className="offersLayout"><section className="offersMain"><div className="sectionTitle"><div><p className="eyebrow">Public offer book</p><h2>Accepted terms are executable</h2><p>Review every obligation and deterministic settlement window before funding.</p></div><span className="countPill">{offers.length} offers</span></div><div className="offerList">{offers.map((offer) => {
    const obligations = offerObligations(offer);
    return <article className="offerCard" key={offer.id}><div className="offerHeader"><div><span className="offerNumber">Offer #{offer.id}</span><h3>{offer.title}</h3><p className="builderLine"><span className="avatar">B</span> Builder {short(offer.builder)}</p></div><span className="offerPrice"><strong>{formatGen(offer.priceAttoGen)}</strong><span>GEN</span></span></div><p className="offerScope">{offer.serviceDescription || offer.scope}</p><div className="offerTerms"><span><Clock3 size={15} /><small>Delivery</small><strong>{offer.deliveryWindowHours ? `${offer.deliveryWindowHours} hours` : `${offer.deadlineDays} days`}</strong></span><span><RefreshCcw size={15} /><small>Revisions</small><strong>{offer.revisionRounds} rounds</strong></span><span><ShieldCheck size={15} /><small>Obligations</small><strong>{obligations.length || "Legacy terms"}</strong></span></div><ObligationList obligations={obligations} legacyOffer={offer} /><div className="offerFooter"><span><LockKeyhole size={13} /> Funds remain in contract escrow until settlement starts</span><button className="primary" disabled={Boolean(config.readOnly)} onClick={() => void executeWrite("Accept Offer", "accept_offer", [offer.id], BigInt(offer.priceAttoGen)).catch(() => undefined)}>Accept &amp; Lock {formatGen(offer.priceAttoGen)} GEN <ArrowRight size={15} /></button></div></article>;
  })}{offers.length === 0 && <EmptyState title="No offers published" body="A Builder can define bounded obligations and publish the first v2 offer." />}</div></section><aside className="trustRail"><div className="trustVisual"><span>Contract-enforced</span><strong>The agreement displayed is the agreement adjudicated.</strong></div><div className="trustSteps"><p className="eyebrow">Before funding</p><div><span>1</span><p><strong>Read every obligation</strong>Each promise has a stable ID and evidence requirement.</p></div><div><span>2</span><p><strong>Check time windows</strong>Revision and refund timing is deterministic.</p></div><div><span>3</span><p><strong>Fund exactly</strong>The contract rejects any mismatched GEN amount.</p></div></div></aside></div>;
}

const blankObligation = (index: number): Obligation => ({ id: `O${index + 1}`, category: "DELIVERABLE", statement: "", acceptanceRule: "", requiredEvidenceTypes: ["DELIVERY"] });

function CreateOffer({ config, walletAddress, executeWrite }: { config: ClauseFlowConfig; walletAddress: string; executeWrite: ExecuteWrite }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [deliveryHours, setDeliveryHours] = useState("");
  const [graceHours, setGraceHours] = useState("");
  const [revisionRounds, setRevisionRounds] = useState("");
  const [revisionHours, setRevisionHours] = useState("");
  const [reviewHours, setReviewHours] = useState("");
  const [obligations, setObligations] = useState<Obligation[]>([blankObligation(0)]);
  const [structuredFingerprint, setStructuredFingerprint] = useState("");
  const fingerprint = JSON.stringify({ title, description, price, deliveryHours, graceHours, revisionRounds, revisionHours, reviewHours, obligations });
  const error = validateOffer({ title, description, price, deliveryHours, graceHours, revisionRounds, revisionHours, reviewHours, obligations });
  const args = (): CalldataEncodable[] => [title, description, JSON.stringify(obligations), parseGen(price), BigInt(deliveryHours), BigInt(graceHours), BigInt(revisionRounds), BigInt(revisionHours), BigInt(reviewHours)];
  const updateObligation = (index: number, patch: Partial<Obligation>) => setObligations((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item));
  if (config.readOnly) return <EmptyState title="Archived contract is read-only" body="Switch to the current v2 contract to create executable obligations." />;
  return <div className="createWorkspace"><section className="formPanel"><div className="formHeading"><div><p className="eyebrow">Builder offer</p><h2>Define only what settlement can enforce</h2><p>Title and context are informational. Every binding promise belongs in the obligation manifest below.</p></div><span className="countPill">{obligations.length}/12 obligations</span></div><div className="fields"><label><span>Offer title</span><input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Specific service agreement" /></label><label><span>Price in GEN</span><input value={price} onChange={(event) => setPrice(event.target.value)} placeholder="0.02" /></label><label className="full"><span>Non-binding context</span><textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Describe the service without adding promises outside the obligation list." /></label></div><div className="commercialFields"><label><span>Delivery hours</span><input value={deliveryHours} onChange={(event) => setDeliveryHours(event.target.value)} inputMode="numeric" placeholder="48" /></label><label><span>Grace hours</span><input value={graceHours} onChange={(event) => setGraceHours(event.target.value)} inputMode="numeric" placeholder="24" /></label><label><span>Revision rounds</span><input value={revisionRounds} onChange={(event) => setRevisionRounds(event.target.value)} inputMode="numeric" placeholder="1" /></label><label><span>Revision hours</span><input value={revisionHours} onChange={(event) => setRevisionHours(event.target.value)} inputMode="numeric" placeholder="24" /></label><label><span>Review timeout hours</span><input value={reviewHours} onChange={(event) => setReviewHours(event.target.value)} inputMode="numeric" placeholder="24" /></label></div><div className="obligationEditor"><div className="sectionTitle"><div><p className="eyebrow">Binding manifest</p><h3>Accepted obligations</h3></div><button className="secondary" type="button" disabled={obligations.length >= 12} onClick={() => setObligations((current) => [...current, blankObligation(current.length)])}><Plus size={14} /> Add obligation</button></div>{obligations.map((obligation, index) => <article className="obligationEditorCard" key={`${obligation.id}-${index}`}><header><span>{obligation.id || `O${index + 1}`}</span><select value={obligation.category} onChange={(event) => updateObligation(index, { category: event.target.value as Obligation["category"] })}><option>SCOPE</option><option>DELIVERABLE</option><option>ACCEPTANCE</option><option>EVIDENCE</option></select><button type="button" className="iconButton" disabled={obligations.length === 1} onClick={() => setObligations((current) => current.filter((_, itemIndex) => itemIndex !== index))} aria-label="Remove obligation"><Trash2 size={14} /></button></header><label><span>Stable ID</span><input value={obligation.id} onChange={(event) => updateObligation(index, { id: event.target.value.toUpperCase() })} placeholder="O_DELIVERY" /></label><label><span>Binding statement</span><textarea value={obligation.statement} onChange={(event) => updateObligation(index, { statement: event.target.value })} placeholder="What the Builder must deliver" /></label><label><span>Acceptance rule</span><textarea value={obligation.acceptanceRule} onChange={(event) => updateObligation(index, { acceptanceRule: event.target.value })} placeholder="What validators must observe to mark this SATISFIED" /></label><label><span>Required evidence types</span><EvidenceTypePicker value={obligation.requiredEvidenceTypes} onChange={(requiredEvidenceTypes) => updateObligation(index, { requiredEvidenceTypes })} /></label></article>)}</div>{error && <div className="inlineValidation">{error}</div>}<div className="actions"><button className="secondary" disabled={Boolean(error)} onClick={() => void executeWrite("Structure Obligations", "structure_offer", args()).then(() => setStructuredFingerprint(fingerprint)).catch(() => undefined)}><Sparkles size={15} /> Structure exact terms</button><button className="primary" disabled={Boolean(error) || structuredFingerprint !== fingerprint} onClick={() => void executeWrite("Publish Offer", "publish_offer", args()).catch(() => undefined)}><FileCheck2 size={15} /> Publish reviewed offer</button></div></section><aside className="draftPanel"><p className="eyebrow">Contract preview</p><h3>{title || "Untitled agreement"}</h3><p>{description || "Context appears here but does not become an unstated obligation."}</p><dl><dt>Builder</dt><dd>{walletAddress ? short(walletAddress) : "Connect wallet"}</dd><dt>Price</dt><dd>{price || "0"} GEN</dd><dt>Refund policy</dt><dd>Rejected, missed delivery plus grace, missed revision, or review timeout.</dd></dl><ObligationList obligations={obligations.filter((item) => item.statement)} /><div className={`draftState ${structuredFingerprint === fingerprint && !error ? "ready" : ""}`}><i /><span>{structuredFingerprint === fingerprint && !error ? "Exact manifest structured on-chain" : "Structure again after every material edit"}</span></div></aside></div>;
}

function DealDetail({ deal, offer, history, evidenceRounds, config, walletAddress, routerReceipt, refundEligibility, txState, executeWrite, releaseSettlement, refreshExtras }: {
  deal: Deal; offer?: Offer; history: HistoryEvent[]; evidenceRounds: EvidenceRound[]; config: ClauseFlowConfig; walletAddress: string;
  routerReceipt: RouterSettlement | null; refundEligibility: RefundEligibility | null; txState: TxState; executeWrite: ExecuteWrite;
  releaseSettlement: (deal: Deal) => Promise<void>; refreshExtras: () => Promise<void>;
}) {
  const [tab, setTab] = useState<"agreement" | "evidence" | "history">("agreement");
  const [sources, setSources] = useState<EvidenceSource[]>([{ id: "E1", type: "DELIVERY", label: "", url: "", versionKind: "GIT_COMMIT", versionId: "", sha256: "" }]);
  const [note, setNote] = useState("");
  const [hashing, setHashing] = useState("");
  const isBuilder = walletAddress.toLowerCase() === deal.builder.toLowerCase();
  const isClient = walletAddress.toLowerCase() === deal.client.toLowerCase();
  const isRecipient = walletAddress.toLowerCase() === (deal.settlementRecipient || "").toLowerCase();
  const obligations = dealObligations(deal, offer);
  const assessments = parseStoredList<ObligationAssessment>(deal.reviewObligationAssessments) || [];
  const legacyAssessments = parseLegacyAssessments(deal);
  const visibleAssessments = assessments.length ? assessments : legacyAssessments;
  const reviewSources = parseStoredList<ReviewSource>(deal.reviewSourceAssessments);
  const strengths = parseStoredList<string>(deal.reviewStrengths);
  const risks = parseStoredList<string>(deal.reviewRisks);
  const missing = parseStoredList<string>(deal.reviewMissingItems);
  const revision = parseStoredList<string>(deal.reviewRevisionChecklist);
  const currentManifest = parseStoredList<EvidenceSource>(deal.currentEvidenceManifest);
  const deliveryError = validateEvidence(sources, note);
  const receiptState = routerReceipt?.state || 0;

  async function hashSource(index: number) {
    const source = sources[index];
    if (!source.url.startsWith("https://")) return;
    setHashing(source.id);
    try {
      const response = await fetch(source.url, { cache: "no-store" });
      if (!response.ok) throw new Error(`Evidence returned HTTP ${response.status}`);
      const bytes = await response.arrayBuffer();
      const digest = await crypto.subtle.digest("SHA-256", bytes);
      const sha256 = Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
      setSources((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, sha256 } : item));
    } catch (error) {
      setHashing("");
      throw new Error(`Browser hash preflight failed: ${normalizeError(error)}`);
    } finally {
      setHashing("");
    }
  }

  return <section className="dealDetail"><header className="dealHero"><div><p className="eyebrow">Agreement CF-{deal.id.padStart(4, "0")}</p><h2>{deal.title}</h2><div className="partyFlow"><span className="avatar">B</span><span><small>Builder</small>{short(deal.builder)}</span><ArrowRight size={14} /><span className="avatar clientAvatar">C</span><span><small>Client</small>{short(deal.client)}</span></div></div><div className="dealHeroState"><Status status={deal.status} /><strong>{formatGen(deal.lockedAttoGen)} <small>GEN</small></strong><span>exact funded value</span></div></header><div className="lifecycle">{["FUNDED", "SUBMITTED", "REVIEWED", "SETTLED"].map((label, index) => <div className={`lifecycleStep ${dealProgress(deal) >= index ? "complete" : ""}`} key={label}><span>{dealProgress(deal) > index ? <CheckCircle2 size={13} /> : index + 1}</span><strong>{label}</strong><small>{lifecycleTime(deal, index)}</small></div>)}</div><div className="dealFacts"><Fact icon={<Clock3 size={16} />} label="Delivery deadline" value={formatUnix(deal.deliveryDueAtUnix || deal.deadlineAtUnix || "0")} /><Fact icon={<RefreshCcw size={16} />} label="Revision deadline" value={formatUnix(deal.revisionDueAtUnix || "0")} /><Fact icon={<ShieldCheck size={16} />} label="Refund eligibility" value={refundEligibility?.eligible ? `Eligible: ${refundEligibility.reason}` : refundEligibility?.reason || "Read from contract"} /></div><div className="detailTabs"><button className={tab === "agreement" ? "active" : ""} onClick={() => setTab("agreement")}><FileText size={15} /> Agreement</button><button className={tab === "evidence" ? "active" : ""} onClick={() => setTab("evidence")}><ClipboardCheck size={15} /> Evidence &amp; review</button><button className={tab === "history" ? "active" : ""} onClick={() => setTab("history")}><Activity size={15} /> On-chain history</button></div>

    {tab === "agreement" && <div className="agreementTab"><section className="agreementDocument"><div className="sectionTitle"><div><p className="eyebrow">Accepted agreement</p><h3>Every binding obligation</h3></div><span className="countPill">Hash {short(deal.obligationsHash || "Legacy")}</span></div><p className="agreementContext">{deal.serviceDescription || offer?.serviceDescription || "Legacy agreement context"}</p><ObligationList obligations={obligations} legacyOffer={offer} expanded /><section className="policyGrid"><Policy label="Initial delivery" value={`${deal.deliveryWindowHours || offer?.deliveryWindowHours || "Legacy"} hours`} /><Policy label="Grace" value={`${deal.gracePeriodHours || offer?.gracePeriodHours || "Legacy"} hours`} /><Policy label="Revision" value={`${deal.revisionCount || "0"}/${deal.maxRevisions || offer?.revisionRounds || "0"} used`} /><Policy label="Review timeout" value={`${deal.reviewWindowHours || offer?.reviewWindowHours || "Legacy"} hours`} /></section></section><aside className="settlementPanel"><p className="eyebrow">Deal-specific settlement</p><h3>{nextActionTitle(deal)}</h3><p>{deal.nextAction}</p><div className="settlementAmount"><small>Escrow value</small><strong>{formatGen(deal.lockedAttoGen)} <span>GEN</span></strong></div>{deal.settlementId && <div className="receiptSummary"><span><Fingerprint size={14} /> Settlement ID</span><code>{deal.settlementId}</code><dl><dt>Router state</dt><dd>{["Not funded", "Funded", "Released"][receiptState] || "Unknown"}</dd><dt>Deal hash</dt><dd>{routerReceipt ? short(routerReceipt.dealHash) : "Awaiting router"}</dd><dt>Recipient</dt><dd>{short(routerReceipt?.recipient || deal.settlementRecipient || "")}</dd><dt>Amount</dt><dd>{formatGen(routerReceipt?.amount.toString() || deal.settlementAmountAtto || "0")} GEN</dd><dt>Kind</dt><dd>{routerReceipt ? (["Unknown", "Payment", "Refund"][routerReceipt.kind] || `Type ${routerReceipt.kind}`) : deal.settlementKind === "1" ? "Payment" : deal.settlementKind === "2" ? "Refund" : "Pending"}</dd><dt>Source</dt><dd>{routerReceipt ? short(routerReceipt.source) : "Awaiting router"}</dd></dl></div>}<div className="actions verticalActions"><button className="primary" disabled={config.readOnly || !isBuilder || deal.status !== "APPROVED"} onClick={() => void executeWrite("Claim Payment", "claim_payment", [deal.id]).catch(() => undefined)}>Start payment settlement</button><button className="secondary" disabled={config.readOnly || !isClient || !refundEligibility?.eligible} onClick={() => void executeWrite("Claim Refund", "claim_refund", [deal.id]).catch(() => undefined)}>Start refund settlement</button><button className="secondary" disabled={config.readOnly || !isRecipient || !["PAYMENT_PENDING", "REFUND_PENDING"].includes(deal.status) || receiptState !== 1} onClick={() => void releaseSettlement(deal).catch(() => undefined)}>Release exact router receipt</button><button className="secondary" disabled={config.readOnly || !["PAYMENT_PENDING", "REFUND_PENDING"].includes(deal.status) || receiptState !== 2} onClick={() => void executeWrite(deal.status === "PAYMENT_PENDING" ? "Confirm Payment" : "Confirm Refund", deal.status === "PAYMENT_PENDING" ? "confirm_payment" : "confirm_refund", [deal.id]).catch(() => undefined)}>Confirm exact receipt on ClauseFlow</button><button className="secondary" onClick={() => void refreshExtras()}><RefreshCcw size={14} /> Refresh settlement proof</button></div><p className="roleHint"><Wallet size={13} /> {walletAddress ? `Connected as ${isBuilder ? "Builder" : isClient ? "Client" : "observer"}` : "Connect the relevant party wallet"}</p></aside></div>}

    {tab === "evidence" && <div className="evidenceTab"><section className="evidencePanel"><div className="sectionTitle"><div><p className="eyebrow">Immutable evidence</p><h3>Append-only submission rounds</h3></div><span className="countPill">{evidenceRounds.length} rounds</span></div>{evidenceRounds.map((round) => <article className="evidenceRound" key={round.round}><header><strong>Round {round.round}</strong><time>{formatDate(round.submittedAt)}</time></header><p>{round.deliveryNote}</p><code>Manifest {round.manifestHash}</code>{round.manifest.map((source) => <LinkLine key={source.id} label={`${source.id} ${source.type}`} href={source.url} detail={`${source.versionKind} ${short(source.versionId)} - sha256 ${short(source.sha256)}`} />)}</article>)}{evidenceRounds.length === 0 && currentManifest.length > 0 && <article className="evidenceRound"><p>{deal.currentDeliveryNote}</p>{currentManifest.map((source) => <LinkLine key={source.id} label={source.type} href={source.url} detail={`sha256 ${short(source.sha256)}`} />)}</article>}{!config.readOnly && <div className="deliveryForm v2EvidenceForm"><div className="deliveryFormHead"><div><p className="eyebrow">Builder submission</p><h3>Versioned source manifest</h3></div><button className="secondary" disabled={sources.length >= 8} onClick={() => setSources((current) => [...current, { id: `E${current.length + 1}`, type: "DELIVERY", label: "", url: "", versionKind: "GIT_COMMIT", versionId: "", sha256: "" }])}><Plus size={14} /> Add source</button></div>{sources.map((source, index) => <article className="evidenceSourceEditor" key={`${source.id}-${index}`}><header><span>{source.id}</span><button className="iconButton" disabled={sources.length === 1} onClick={() => setSources((current) => current.filter((_, itemIndex) => itemIndex !== index))}><Trash2 size={13} /></button></header><input value={source.label} onChange={(event) => setSources(updateAt(sources, index, { label: event.target.value }))} placeholder="Evidence label" /><select value={source.type} onChange={(event) => setSources(updateAt(sources, index, { type: event.target.value as EvidenceType }))}>{["DELIVERY", "DEMO", "DOCUMENTATION", "SOURCE", "AUDIT", "OTHER"].map((value) => <option key={value}>{value}</option>)}</select><input value={source.url} onChange={(event) => setSources(updateAt(sources, index, { url: event.target.value }))} placeholder="Immutable HTTPS URL" /><select value={source.versionKind} onChange={(event) => setSources(updateAt(sources, index, { versionKind: event.target.value as VersionKind }))}>{["GIT_COMMIT", "IPFS_CID", "VERCEL_DEPLOYMENT"].map((value) => <option key={value}>{value}</option>)}</select><input value={source.versionId} onChange={(event) => setSources(updateAt(sources, index, { versionId: event.target.value }))} placeholder="Commit, CID, or deployment ID" /><div className="hashField"><input value={source.sha256} onChange={(event) => setSources(updateAt(sources, index, { sha256: event.target.value.toLowerCase() }))} placeholder="SHA-256" /><button className="secondary" disabled={!source.url || hashing === source.id} onClick={() => void hashSource(index).catch(() => undefined)}><Hash size={13} /> {hashing === source.id ? "Hashing" : "Fetch & hash"}</button></div></article>)}<textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Explain how this immutable evidence addresses the accepted obligations." />{deliveryError && <div className="inlineValidation">{deliveryError}</div>}<button className="primary" disabled={!isBuilder || Boolean(deliveryError) || !["FUNDED", "REVISION_REQUIRED"].includes(deal.status)} onClick={() => void executeWrite("Submit Immutable Evidence", "submit_delivery", [deal.id, JSON.stringify(sources), note]).catch(() => undefined)}><GitBranch size={15} /> Submit evidence round</button></div>}</section><section className={`reviewPanel ${deal.reviewResult.toLowerCase()}`}><div className="reviewHeading"><span className="reviewSeal"><ShieldCheck size={21} /></span><div><p className="eyebrow">Validator outcome</p><h3>{humanReviewResult(deal.reviewResult)}</h3></div><strong className="reviewScore">{deal.reviewScore || "0"}<small>/100</small></strong></div>{deal.reviewExecutiveSummary && <p className="reviewReason">{deal.reviewExecutiveSummary}</p>}{deal.reviewedAt && <div className="fullReportCue"><ClipboardCheck size={16} /><span><strong>Full validator report</strong><small>{visibleAssessments.length} accepted obligations and {reviewSources.length} immutable sources stored on-chain.</small></span></div>}{visibleAssessments.length > 0 ? <ReviewAssessments assessments={visibleAssessments} sources={reviewSources} /> : deal.reviewedAt && <div className="notice warning"><ShieldCheck size={15} /><span>No obligation-level report was stored. ClauseFlow does not infer replacement reasoning.</span></div>}{reviewSources.length > 0 && <ReviewSources sources={reviewSources} />}{(strengths.length > 0 || risks.length > 0) && <div className="reviewSignals">{strengths.length > 0 && <ClauseBlock title="Verified strengths" items={strengths} />}{risks.length > 0 && <ClauseBlock title="Risks and gaps" items={risks} />}</div>}{missing.length > 0 && <ClauseBlock title="Missing items" items={missing} />}{revision.length > 0 && <ClauseBlock title="Revision checklist" items={revision} />}{deal.reviewConsensusBasis && <div className="consensusNote"><ShieldCheck size={16} /><span><strong>On-chain verification rule</strong>{deal.reviewConsensusBasis}</span></div>}<button className="primary wide" disabled={config.readOnly || deal.status !== "SUBMITTED"} onClick={() => void executeWrite("Run Validator Review", "review_delivery", [deal.id]).catch(() => undefined)}><Sparkles size={16} /> Run independent validator review</button></section></div>}

    {tab === "history" && <div className="historyTab"><section className="historyPanel"><div className="sectionTitle"><div><p className="eyebrow">Canonical record</p><h3>Agreement lifecycle</h3></div><span className="countPill">{history.length} events</span></div><div className="historyList">{history.map((event, index) => <div key={`${event.eventType}-${index}`}><span className="historyNode"><CheckCircle2 size={15} /></span><div><strong>{event.eventType.replaceAll("_", " ")}</strong><time>{formatDate(event.timestamp)}</time><p>{event.note}</p><div className="historyProofs">{/^0x[a-fA-F0-9]{40}$/.test(event.actor) && <a href={explorerAddressUrl(config, event.actor)} target="_blank" rel="noreferrer">Actor {short(event.actor)} <ExternalLink size={12} /></a>}<a href={explorerAddressUrl(config, config.contractAddress)} target="_blank" rel="noreferrer">Contract record <ExternalLink size={12} /></a></div></div></div>)}</div></section><section className="txPanel"><div className="sectionTitle"><div><p className="eyebrow">Browser session</p><h3>Transaction proof</h3></div><Status status={txState.lifecycle.toUpperCase()} /></div><dl><dt>Action</dt><dd>{txState.label}</dd><dt>Lifecycle</dt><dd>{txState.lifecycle}</dd><dt>Execution</dt><dd>{txState.executionResult}</dd><dt>Consensus</dt><dd>{txState.consensusResult}</dd><dt>Hash</dt><dd>{txState.hash && <a href={explorerTxUrl(config, txState.hash)} target="_blank" rel="noreferrer">{txState.hash} <ExternalLink size={12} /></a>}</dd></dl><p>{txState.message}</p>{txState.childTransactions.map((hash) => <a className="childTx" key={hash} href={explorerTxUrl(config, hash)} target="_blank" rel="noreferrer">Child transaction {short(hash)} <ExternalLink size={12} /></a>)}</section></div>}
    {tab === "agreement" && isRecipient && ["PAYMENT_PENDING", "REFUND_PENDING"].includes(deal.status) && receiptState === 0 && !config.readOnly && <section className="settlementRecovery"><div><p className="eyebrow">Receipt recovery</p><strong>Router credit is awaiting an exact receipt binding</strong><p>This retry binds existing Router credit to this deal. It does not transfer additional GEN.</p></div><button className="secondary" onClick={() => void executeWrite("Retry Receipt Binding", "retry_settlement_funding", [deal.id]).catch(() => undefined)}><RefreshCcw size={14} /> Retry binding (no GEN)</button></section>}
  </section>;
}

function EvidenceTypePicker({ value, onChange }: { value: EvidenceType[]; onChange: (value: EvidenceType[]) => void }) {
  return <div className="evidenceTypePicker">{(["DELIVERY", "DEMO", "DOCUMENTATION", "SOURCE", "AUDIT", "OTHER"] as EvidenceType[]).map((type) => <label key={type}><input type="checkbox" checked={value.includes(type)} onChange={(event) => onChange(event.target.checked ? [...value, type] : value.filter((item) => item !== type))} /> {type}</label>)}</div>;
}

function ObligationList({ obligations, legacyOffer, expanded = false }: { obligations: Obligation[]; legacyOffer?: Offer; expanded?: boolean }) {
  const [open, setOpen] = useState(expanded);
  useEffect(() => setOpen(expanded), [expanded]);
  if (obligations.length === 0 && legacyOffer) return <details className="offerClauses" open={open} onToggle={(event) => setOpen(event.currentTarget.open)}><summary><span>{expanded ? "Full accepted legacy terms" : "Review legacy clauses"}</span><ChevronRight size={16} /></summary><ClauseBlock title="Scope" items={[legacyOffer.scope || "Not stored"]} /><ClauseBlock title="Deliverables" items={[legacyOffer.deliverables || "Not stored"]} /><ClauseBlock title="Acceptance criteria" items={[legacyOffer.acceptanceCriteria || "Not stored"]} /><ClauseBlock title="Refund" items={[legacyOffer.refundRule || "Legacy rule"]} /></details>;
  return <details className="offerClauses obligationList" open={open} onToggle={(event) => setOpen(event.currentTarget.open)}><summary><span>{expanded ? "Full accepted obligations" : `Review ${obligations.length} obligations`}</span><ChevronRight size={16} /></summary>{obligations.map((obligation) => <article className="obligationCard" key={obligation.id}><header><span>{obligation.id}</span><strong>{obligation.category}</strong></header><p>{obligation.statement}</p><dl><dt>Acceptance rule</dt><dd>{obligation.acceptanceRule}</dd><dt>Required evidence</dt><dd>{obligation.requiredEvidenceTypes.join(", ")}</dd></dl></article>)}</details>;
}

function ReviewAssessments({ assessments, sources }: { assessments: ObligationAssessment[]; sources: ReviewSource[] }) {
  const byId = new Map(sources.map((source) => [source.id, source]));
  return <section className="assessmentSection"><div className="assessmentSectionTitle"><h4>Accepted obligation results</h4><span>{assessments.length} adjudicated</span></div><div className="assessmentList">{assessments.map((assessment) => <article className="assessmentCard" key={assessment.obligationId}><header><span className="assessmentId">{assessment.obligationId}</span><strong>{assessment.statement}</strong><span className={`assessmentStatus ${assessment.status.toLowerCase()}`}>{assessment.status.replaceAll("_", " ")}</span></header><div className="assessmentBody"><p><b>Finding</b>{assessment.finding}</p><p><b>Validator reasoning</b>{assessment.reasoning}</p>{assessment.acceptanceRule && <p><b>Accepted rule</b>{assessment.acceptanceRule}</p>}</div>{assessment.evidenceIds?.length > 0 && <footer>{assessment.evidenceIds.map((id) => { const source = byId.get(id); return source?.url ? <a key={id} href={source.url} target="_blank" rel="noreferrer">{id} {source.label} <ExternalLink size={12} /></a> : <span key={id}>{id}</span>; })}</footer>}</article>)}</div></section>;
}

function ReviewSources({ sources }: { sources: ReviewSource[] }) {
  return <section className="sourceReview"><div className="assessmentSectionTitle"><h4>Immutable evidence sources</h4><span>{sources.filter((source) => source.accessible && source.versionMatched !== false).length}/{sources.length} verified</span></div><div className="sourceReviewGrid">{sources.map((source, index) => <article key={source.id || `${source.label}-${index}`} className={source.accessible && source.versionMatched !== false ? "accessible" : "unavailable"}><header><strong>{source.id ? `${source.id} ${source.label}` : source.label}</strong><span>{source.accessible && source.versionMatched !== false ? "Hash matched" : "Unverified"}</span></header>{source.versionKind && <small>{source.versionKind} {source.versionId}</small>}{source.actualSha256 && <code>{source.actualSha256}</code>}{source.finding && <p>{source.finding}</p>}{source.error && <p>{source.error}</p>}<a href={source.url} target="_blank" rel="noreferrer">Open source <ExternalLink size={11} /></a></article>)}</div></section>;
}

function TransactionBanner({ txState, config, onDismiss }: { txState: TxState; config: ClauseFlowConfig; onDismiss: () => void }) {
  return <section className={`txToast ${txState.lifecycle}`} aria-live="polite"><span className="txToastIcon">{txState.lifecycle === "failed" ? <X size={17} /> : txState.lifecycle === "pending" ? <RefreshCcw className="spin" size={17} /> : <CheckCircle2 size={17} />}</span><div><strong>{txState.label}</strong><p>{txState.message}</p><span>{txState.executionResult} / {txState.consensusResult}</span></div><div className="txToastActions">{txState.hash && <a href={explorerTxUrl(config, txState.hash)} target="_blank" rel="noreferrer"><ExternalLink size={15} /></a>}<button className="iconButton" onClick={onDismiss}><X size={15} /></button></div></section>;
}

function Metric({ icon, label, value, loading = false }: { icon: ReactNode; label: string; value: string; loading?: boolean }) { return <div className={`metric ${loading ? "metricLoading" : ""}`}><span className="metricIcon">{icon}</span><div><span>{label}</span><strong>{value}</strong></div></div>; }
function Status({ status }: { status: string }) { return <span className={`status ${status.toLowerCase().replaceAll("_", "")}`}><i /> {status.replaceAll("_", " ")}</span>; }
function Fact({ icon, label, value }: { icon: ReactNode; label: string; value: string }) { return <div>{icon}<span><small>{label}</small><strong title={value}>{value}</strong></span></div>; }
function Policy({ label, value }: { label: string; value: string }) { return <div><small>{label}</small><strong>{value}</strong></div>; }
function ClauseBlock({ title, items }: { title: string; items: string[] }) { return <div className="clause"><h3>{title}</h3><ul>{items.map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}</ul></div>; }
function LinkLine({ label, href, detail }: { label: string; href: string; detail?: string }) { return <div className="linkLine"><span>{label}</span><a href={href} target="_blank" rel="noreferrer"><span>{displayUrl(href)}{detail && <small>{detail}</small>}</span><ExternalLink size={14} /></a></div>; }
function EmptyState({ title, body }: { title: string; body: string }) { return <div className="emptyState"><span className="emptyIcon"><FileText size={20} /></span><h3>{title}</h3><p>{body}</p></div>; }

function offerObligations(offer: Offer): Obligation[] { return parseStoredList<Obligation>(offer.obligations); }
function dealObligations(deal: Deal, offer?: Offer): Obligation[] { return parseStoredList<Obligation>(deal.obligations).length ? parseStoredList<Obligation>(deal.obligations) : offer ? offerObligations(offer) : []; }
function parseStoredList<T>(value?: string): T[] { if (!value) return []; try { const parsed: unknown = JSON.parse(value); return Array.isArray(parsed) ? parsed as T[] : []; } catch { return []; } }
function parseLegacyAssessments(deal: Deal): ObligationAssessment[] {
  const criteria = parseStoredList<Record<string, unknown>>(deal.reviewCriterionAssessments);
  const deliverables = parseStoredList<Record<string, unknown>>(deal.reviewDeliverableAssessments);
  return [...criteria, ...deliverables].map((item, index) => ({
    obligationId: String(item.id || `L${index + 1}`),
    statement: String(item.criterion || item.deliverable || "Legacy accepted term"),
    status: String(item.status || "UNVERIFIABLE") as ObligationAssessment["status"],
    finding: String(item.finding || ""), reasoning: String(item.reasoning || ""), evidenceIds: []
  }));
}
function updateAt<T>(items: T[], index: number, patch: Partial<T>) { return items.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item); }
function validateOffer(value: { title: string; description: string; price: string; deliveryHours: string; graceHours: string; revisionRounds: string; revisionHours: string; reviewHours: string; obligations: Obligation[] }) {
  if (value.title.trim().length < 6) return "Offer title must contain at least 6 characters.";
  if (value.description.trim().length < 12) return "Context must contain at least 12 characters.";
  try { if (parseGen(value.price) <= 0n) return "Price must be greater than zero."; } catch (error) { return normalizeError(error); }
  for (const [label, field] of [["Delivery", value.deliveryHours], ["Grace", value.graceHours], ["Revision rounds", value.revisionRounds], ["Revision window", value.revisionHours], ["Review timeout", value.reviewHours]]) if (!/^\d+$/.test(field)) return `${label} must be a whole number.`;
  if (Number(value.revisionRounds) > 3) return "At most 3 revision rounds are supported.";
  const ids = value.obligations.map((item) => item.id.trim().toUpperCase());
  if (new Set(ids).size !== ids.length) return "Every obligation ID must be unique.";
  const invalid = value.obligations.find((item) => !/^[A-Z][A-Z0-9_-]{0,23}$/.test(item.id) || item.statement.trim().length < 12 || item.acceptanceRule.trim().length < 12 || item.requiredEvidenceTypes.length === 0);
  return invalid ? "Every obligation needs a stable uppercase ID, a specific statement, an acceptance rule, and evidence type." : "";
}
function validateEvidence(sources: EvidenceSource[], note: string) {
  if (note.trim().length < 12) return "Delivery note must explain the immutable evidence.";
  for (const source of sources) {
    if (!/^E[A-Z0-9_-]{0,23}$/.test(source.id)) return "Evidence IDs must begin with E and be unique uppercase identifiers.";
    if (source.label.trim().length < 3 || !source.url.startsWith("https://")) return "Every evidence source needs a label and HTTPS URL.";
    if (!/^[0-9a-f]{64}$/.test(source.sha256)) return "Every evidence source needs a 64-character lowercase SHA-256.";
    if (!source.url.toLowerCase().includes(source.versionId.toLowerCase())) return "The immutable URL must contain its commit, CID, or deployment ID.";
    if (source.versionKind === "GIT_COMMIT" && !/^[0-9a-fA-F]{40}$/.test(source.versionId)) return "Git evidence requires a full 40-character commit hash.";
  }
  return new Set(sources.map((source) => source.id)).size === sources.length ? "" : "Evidence IDs must be unique.";
}
function nextActionTitle(deal: Deal) { if (deal.status === "APPROVED") return "Payment settlement is ready"; if (deal.status === "PAYMENT_PENDING") return "Builder receipt in progress"; if (deal.status === "REFUND_PENDING") return "Client receipt in progress"; if (deal.status === "PAID") return "Builder paid"; if (deal.status === "REFUNDED") return "Client refunded"; if (deal.status === "REVISION_REQUIRED") return "Revision window is active"; if (deal.status === "REJECTED") return "Refund is available"; if (deal.status === "SUBMITTED") return "Validator review is ready"; return "Delivery window is active"; }
function dealProgress(deal: Deal) { if (["PAID", "REFUNDED"].includes(deal.status)) return 3; if (["APPROVED", "REVISION_REQUIRED", "REJECTED", "PAYMENT_PENDING", "REFUND_PENDING"].includes(deal.status)) return 2; if (deal.status === "SUBMITTED") return 1; return 0; }
function lifecycleTime(deal: Deal, index: number) { return [deal.fundedAt, deal.submittedAt, deal.reviewedAt, deal.completedAt][index] ? formatDate([deal.fundedAt, deal.submittedAt, deal.reviewedAt, deal.completedAt][index]) : "Pending"; }
function humanReviewResult(result: string) { if (!result) return "Awaiting review"; return result.replaceAll("_", " ").toLowerCase().replace(/^\w/, (letter) => letter.toUpperCase()); }
function titleFor(view: View) { return view === "offers" ? "Published Builder offers" : view === "create" ? "Create an executable offer" : view === "deal" ? "Agreement execution detail" : "Public on-chain agreement dashboard"; }
function viewLabel(view: View) { return view === "deal" ? "Agreement" : view === "create" ? "New offer" : view.charAt(0).toUpperCase() + view.slice(1); }
function parseGen(value: string) { const normalized = value.trim(); if (!/^\d+(\.\d{1,18})?$/.test(normalized)) throw new Error("GEN amount must use at most 18 decimals."); const [whole, fraction = ""] = normalized.split("."); return BigInt(whole) * 10n ** 18n + BigInt(fraction.padEnd(18, "0")); }
function formatGen(value: string) { try { const amount = BigInt(value || "0"); const whole = amount / 10n ** 18n; const fraction = (amount % 10n ** 18n).toString().padStart(18, "0").slice(0, 4).replace(/0+$/, ""); return fraction ? `${whole}.${fraction}` : whole.toString(); } catch { return "0"; } }
function short(value: string) { if (!value) return "Not set"; return value.length > 14 ? `${value.slice(0, 7)}...${value.slice(-5)}` : value; }
function formatDate(value: string) { if (!value) return "Pending"; const date = new Date(value); return Number.isNaN(date.getTime()) ? value : date.toLocaleString(); }
function formatUnix(value: string) { const seconds = Number(value); return Number.isFinite(seconds) && seconds > 0 ? new Date(seconds * 1000).toLocaleString() : "Not active"; }
function displayUrl(value: string) { try { const url = new URL(value); return `${url.hostname}${url.pathname === "/" ? "" : url.pathname}`; } catch { return value; } }
