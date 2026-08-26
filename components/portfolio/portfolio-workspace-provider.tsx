"use client";

import type { Dispatch, ReactNode, SetStateAction } from "react";
import {
  startTransition,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import dynamic from "next/dynamic";
import { usePathname, useRouter } from "next/navigation";
import { SpinnerLabel } from "@/components/ui/spinner";
import { toast } from "sonner";

import { usePlanAccessOptional } from "@/components/account/plan-access-provider";
import { ProFeatureBadge } from "@/components/account/pro-feature-badge";
import { FreePortfolioPickModal } from "@/components/account/free-plan-modals";
import { countBrokeragePortfolios, countManualPortfoliosForFreeQuota, isManualPortfolioForFreeQuota } from "@/lib/account/free-plan-quota";
import {
  FREE_HOLDINGS_LIMIT_CODE,
  freeHoldingsLimitMessage,
} from "@/lib/account/free-plan-asset-limits";
import { PATH_ACCOUNT_PLANS } from "@/lib/auth/routes";
import { toastProUpgrade } from "@/lib/account/toast-pro-upgrade";
import { buildDemoPortfolioSeed, demoLedgerNeedsReseed, ensureDemoDividendTransactions } from "@/lib/portfolio/demo-portfolio-seed";
import { SegmentedControl } from "@/components/design-system/segmented-control";
import { AddCashModal } from "@/components/layout/add-cash-modal";
import { DeletePortfolioConfirmModal } from "@/components/portfolio/delete-portfolio-confirm-modal";
import { ClearableInput } from "@/components/layout/clearable-input";

/** Lazy: keeps xlsx + company picker out of the shared protected-shell client graph. */
const ImportTransactionsModal = dynamic(
  () =>
    import("@/components/portfolio/import-transactions-modal").then((m) => m.ImportTransactionsModal),
  { ssr: false },
);
const NewTransactionModal = dynamic(
  () => import("@/components/layout/new-transaction-modal").then((m) => m.NewTransactionModal),
  { ssr: false },
);
const EditTransactionModal = dynamic(
  () => import("@/components/layout/edit-transaction-modal").then((m) => m.EditTransactionModal),
  { ssr: false },
);
import {
  CombinedPortfolioSourceHint,
  CombinedPortfolioSourcesPicker,
} from "@/components/portfolio/combined-portfolio-sources-picker";
import { ConnectBrokerageFlow } from "@/components/portfolio/connect-brokerage-flow";
import { useSnapTradeConnectPortal } from "@/components/portfolio/use-snaptrade-connect-portal";
import { PortfolioSnaptradeSyncModal } from "@/components/portfolio/portfolio-snaptrade-sync-modal";
import { CreateCombinedPortfolioModal } from "@/components/portfolio/create-combined-portfolio-modal";
import { PortfolioWorkspaceContext } from "@/components/portfolio/portfolio-workspace-context";
import { AppModalOverlay } from "@/components/ui/app-modal-overlay";
import {
  AppModalFooter,
  AppModalShell,
  appModalCancelButtonClass,
  appModalPrimaryButtonClass,
} from "@/components/ui/app-modal-shell";
import {
  DEFAULT_PORTFOLIO_SNAPTRADE_SYNC_SETTINGS,
} from "@/lib/snaptrade/sync-settings";
import { mergeSnaptradeSyncSafe } from "@/lib/snaptrade/snaptrade-sync-merge";
import {
  isSnaptradeBrokerRow,
  normalizeTransactionsProvenance,
} from "@/lib/snaptrade/snaptrade-provenance";
import { defaultSnaptradeUpdateFromYmd } from "@/lib/snaptrade/sync-update-from";
import { PortfolioPrivacySelect, PortfolioPrivacyFieldLabel } from "@/components/portfolio/portfolio-privacy-select";
import { PortfolioSnaptradeConnectionInfo } from "@/components/portfolio/portfolio-snaptrade-connection-info";
import type { CompanyPick } from "@/components/charting/company-picker";
import {
  newPortfolioId,
  newTransactionRowId,
  portfolioIsCombined,
  portfolioIsDemo,
  portfolioIsLiveBrokerage,
  portfolioIsOfflineBrokerage,
  type ConnectBrokerageCompletePayload,
  type PortfolioEntry,
  type PortfolioHolding,
  type PortfolioPrivacy,
  type PortfolioSnaptradeLink,
  type PortfolioTransaction,
} from "@/components/portfolio/portfolio-types";
import { mergeHoldingsBySymbol, mergeTransactionsSorted } from "@/lib/portfolio/merge-combined-portfolio";
import {
  stampNewTransaction,
  validatePortfolioLedgerMutation,
} from "@/lib/portfolio/ledger/portfolio-ledger-validate";
import { migratePortfolioTransactionSequences } from "@/lib/portfolio/ledger/portfolio-ledger-migrate";
import { tagLegacyAnomalySells } from "@/lib/portfolio/ledger/portfolio-ledger-engine";
import { prepareWorkspaceLedgerForPersist } from "@/lib/portfolio/ledger/portfolio-ledger-prepare";
import {
  coalesceSelectedPortfolioId,
  loadLastSelectedPortfolioId,
  loadPersistedPortfolioStateForUser,
  parsePersistedPortfolioUnknown,
  portfolioStateHasLedgerData,
  saveLastSelectedPortfolioId,
  savePersistedPortfolioStateForUser,
  type PersistedPortfolioState,
} from "@/lib/portfolio/portfolio-storage";
import { computePublicPortfolioListingMetrics, withListingOwner } from "@/lib/portfolio/public-listing-metrics";
import { buildPublicListingSnapshot } from "@/lib/portfolio/public-listing-snapshot";
import { dispatchPublicListingsChanged, putPublicPortfolioListingRequest } from "@/lib/portfolio/sync-public-listing-client";
import {
  holdingsSliceForPortfolioLiveQuotes,
  portfolioPathnameUsesEagerLiveQuotes,
} from "@/lib/portfolio/portfolio-live-quotes-paths";
import { portfolioLedgerFingerprint } from "@/lib/portfolio/portfolio-ledger-fingerprint";
import {
  refreshHoldingsByPortfolioIdMarketPrices,
  refreshHoldingMarketPrices,
  replayTradeTransactionsToHoldings,
} from "@/lib/portfolio/rebuild-holdings-from-trades";

/** Always keep at least one portfolio; created when the user deletes the last one. */
const DEFAULT_PORTFOLIO_NAME = "My Portfolio";

function ensureAtLeastOnePortfolio(portfolios: PortfolioEntry[]): PortfolioEntry[] {
  if (portfolios.length > 0) return portfolios;
  return [{ id: newPortfolioId(), name: DEFAULT_PORTFOLIO_NAME, privacy: "private" }];
}

function ModalField({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <div className="flex w-full flex-col gap-2">
      {typeof label === "string" ? (
        <span className="text-sm font-medium leading-5 text-fg">{label}</span>
      ) : (
        label
      )}
      {children}
    </div>
  );
}

function EditPortfolioModal({
  initialName,
  initialPrivacy,
  isCombined = false,
  isDemo = false,
  allPortfolios,
  initialCombinedFromIds,
  snaptradeLink,
  privacyDisabled = false,
  privacyDisabledValues,
  onClose,
  onSave,
  onRequestDelete,
}: {
  initialName: string;
  initialPrivacy: PortfolioPrivacy;
  isCombined?: boolean;
  isDemo?: boolean;
  allPortfolios: PortfolioEntry[];
  initialCombinedFromIds?: string[];
  snaptradeLink?: PortfolioSnaptradeLink | null;
  /** Empty portfolios cannot change privacy until they have transactions. */
  privacyDisabled?: boolean;
  /** e.g. Free plan cannot select Public. */
  privacyDisabledValues?: readonly PortfolioPrivacy[];
  onClose: () => void;
  onSave: (name: string, privacy: PortfolioPrivacy, combinedSourceIds?: string[]) => void;
  /** Opens delete confirmation; does not delete immediately. */
  onRequestDelete: () => void;
}) {
  const titleId = useId();
  const [name, setName] = useState(initialName);
  const [privacy, setPrivacy] = useState<PortfolioPrivacy>(isDemo ? "private" : initialPrivacy);

  const standardPortfolios = useMemo(
    () => allPortfolios.filter((p) => p.kind !== "combined"),
    [allPortfolios],
  );

  const [picked, setPicked] = useState<Record<string, boolean>>(() => {
    if (!isCombined || !initialCombinedFromIds) return {};
    const allowed = new Set(standardPortfolios.map((p) => p.id));
    const o: Record<string, boolean> = {};
    for (const id of initialCombinedFromIds) {
      if (allowed.has(id)) o[id] = true;
    }
    return o;
  });

  const selectedSourceIds = useMemo(
    () => standardPortfolios.filter((p) => picked[p.id]).map((p) => p.id),
    [standardPortfolios, picked],
  );

  const toggleSource = useCallback((id: string) => {
    setPicked((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  useEffect(() => {
    setName(initialName);
  }, [initialName]);

  useEffect(() => {
    setPrivacy(isDemo ? "private" : initialPrivacy);
  }, [initialPrivacy, isDemo]);

  const saveEnabled = !(isCombined && (name.trim().length === 0 || selectedSourceIds.length < 2));

  return (
    <AppModalOverlay open onClose={onClose} zIndex={110}>
      <AppModalShell
        titleId={titleId}
        title={isCombined ? "Edit combined portfolio" : "Edit portfolio"}
        onClose={onClose}
        bodyClassName="flex flex-col gap-4 px-5 pb-5 pt-5"
        footer={
          <AppModalFooter>
            <button
              type="button"
              onClick={onRequestDelete}
              className="inline-flex min-h-9 shrink-0 items-center justify-center rounded-[10px] px-4 py-2 text-sm font-medium text-down transition-colors hover:bg-down-soft hover:text-down"
            >
              Delete
            </button>
            <button
              type="button"
              disabled={!saveEnabled}
              onClick={() =>
                isCombined ?
                  onSave(name.trim(), privacy, selectedSourceIds)
                : onSave(name, privacy)
              }
              className={appModalPrimaryButtonClass(saveEnabled)}
            >
              Save
            </button>
          </AppModalFooter>
        }
      >
        <ModalField label="Name">
          <ClearableInput
            type="text"
            value={name}
            onChange={setName}
            placeholder="Portfolio name"
            clearLabel="Clear name"
          />
        </ModalField>
        {isCombined ? (
          <ModalField label="Portfolios to include">
            <CombinedPortfolioSourceHint />
            <CombinedPortfolioSourcesPicker
              standardPortfolios={standardPortfolios}
              picked={picked}
              onToggle={toggleSource}
            />
          </ModalField>
        ) : null}
        {!isDemo ? (
          <ModalField label={<PortfolioPrivacyFieldLabel />}>
            <PortfolioPrivacySelect
              value={privacy}
              onChange={setPrivacy}
              disabled={privacyDisabled}
              disabledValues={privacyDisabledValues}
            />
          </ModalField>
        ) : null}
        {snaptradeLink ? <PortfolioSnaptradeConnectionInfo snaptrade={snaptradeLink} /> : null}
      </AppModalShell>
    </AppModalOverlay>
  );
}

type CreatePortfolioMode = "manual" | "brokerage";

function CreatePortfolioModal({
  onClose,
  onAdd,
  onConnectBrokerageComplete,
  initialMode = "manual",
}: {
  onClose: () => void;
  onAdd: (name: string, privacy: PortfolioPrivacy) => void;
  onConnectBrokerageComplete: (payload: ConnectBrokerageCompletePayload) => void | Promise<void>;
  initialMode?: CreatePortfolioMode;
}) {
  const titleId = useId();
  const plan = usePlanAccessOptional();
  const [mode, setMode] = useState<CreatePortfolioMode>(initialMode);
  const [name, setName] = useState("");
  const [privacy, setPrivacy] = useState<PortfolioPrivacy>("private");

  const { portalLoading, portalActive, portalNode, reset, startPortal } = useSnapTradeConnectPortal({
    onComplete: onConnectBrokerageComplete,
    onClose,
  });

  const closeAll = useCallback(() => {
    reset();
    setMode(initialMode);
    setName("");
    setPrivacy("private");
    onClose();
  }, [initialMode, onClose, reset]);

  const canSubmit = name.trim().length > 0 && !portalLoading;
  const canConnectBrokerage = plan?.canConnectBrokerage !== false;
  const isBrokerage = mode === "brokerage" && canConnectBrokerage;

  useEffect(() => {
    if (!canConnectBrokerage && mode === "brokerage") setMode("manual");
  }, [canConnectBrokerage, mode]);

  if (portalActive) return portalNode;

  return (
    <AppModalOverlay open onClose={closeAll} zIndex={110}>
      <AppModalShell
        titleId={titleId}
        title="Create New Portfolio"
        onClose={closeAll}
        bodyClassName="flex flex-col gap-4 px-5 pb-5 pt-5"
        footer={
          <AppModalFooter>
            <button type="button" onClick={closeAll} className={appModalCancelButtonClass}>
              Cancel
            </button>
            {isBrokerage ? (
              <button
                type="button"
                disabled={!canSubmit}
                onClick={() => {
                  const t = name.trim();
                  if (!t) return;
                  void startPortal({ name: t, privacy });
                }}
                className={appModalPrimaryButtonClass(canSubmit)}
              >
                {portalLoading ? <SpinnerLabel>Opening…</SpinnerLabel> : "Continue"}
              </button>
            ) : (
              <button
                type="button"
                disabled={!canSubmit}
                onClick={() => onAdd(name, privacy)}
                className={appModalPrimaryButtonClass(canSubmit)}
              >
                Add
              </button>
            )}
          </AppModalFooter>
        }
      >
        <SegmentedControl
          fullWidth
          aria-label="Portfolio type"
          value={canConnectBrokerage ? mode : "manual"}
          onChange={(next) => {
            if (next === "brokerage" && !canConnectBrokerage) return;
            setMode(next);
          }}
          options={[
            { value: "manual", label: "Manual Portfolio" },
            {
              value: "brokerage",
              label:
                canConnectBrokerage ? (
                  "Connect brokerage"
                ) : (
                  <span className="inline-flex items-center justify-center gap-1.5">
                    <span>Connect brokerage</span>
                    <ProFeatureBadge
                      label="Brokerage connection is available on Pro only"
                      zIndex={350}
                    />
                  </span>
                ),
              "aria-label": "Connect brokerage",
              disabled: !canConnectBrokerage,
            },
          ]}
        />
        {!canConnectBrokerage ? (
          <p className="text-[13px] leading-5 text-fg-muted">
            Brokerage connection is on Pro. Free includes one manual portfolio.
          </p>
        ) : null}
        <ModalField label="Name">
          <ClearableInput
            type="text"
            value={name}
            onChange={setName}
            placeholder="Enter name"
            clearLabel="Clear name"
          />
        </ModalField>
        <ModalField label={<PortfolioPrivacyFieldLabel />}>
          <PortfolioPrivacySelect
            value={privacy}
            onChange={setPrivacy}
            disabledValues={
              plan && !plan.canPublishPublicPortfolio ? (["public"] as const) : undefined
            }
          />
        </ModalField>
      </AppModalShell>
    </AppModalOverlay>
  );
}

export function PortfolioWorkspaceProvider({
  children,
  userId,
  listingOwnerDisplayName,
  listingOwnerAvatarUrl,
}: {
  children: ReactNode;
  userId: string;
  /** Shown on `/portfolios` community cards (from account profile). */
  listingOwnerDisplayName: string;
  listingOwnerAvatarUrl: string | null;
}) {
  const ownerForListing = useMemo(
    () => ({ displayName: listingOwnerDisplayName, avatarUrl: listingOwnerAvatarUrl }),
    [listingOwnerDisplayName, listingOwnerAvatarUrl],
  );

  const metricsForPublicListing = useCallback(
    (holdings: PortfolioHolding[], txs: PortfolioTransaction[]) => {
      const base = withListingOwner(computePublicPortfolioListingMetrics(holdings, txs), ownerForListing);
      const snapshot = buildPublicListingSnapshot(holdings, txs);
      return snapshot ? { ...base, snapshot } : base;
    },
    [ownerForListing],
  );
  const plan = usePlanAccessOptional();
  const router = useRouter();
  const openUpgradePlans = useCallback(() => {
    router.push(PATH_ACCOUNT_PLANS);
  }, [router]);
  const [freePortfolioPickOpen, setFreePortfolioPickOpen] = useState(false);
  const demoSeededRef = useRef(false);
  /** Portfolio ids whose demo ledger was replaced for {@link DEMO_LEDGER_REVISION}. */
  const demoReseedDoneRef = useRef(new Set<string>());

  /** Must match server vs client first paint — never use {@link newPortfolioId} in initial seed (random UUID). */
  const portfolioSeedId = useId().replace(/:/g, "");
  const portfolioSeed = useMemo(() => {
    const id = `pf_${portfolioSeedId}`;
    return {
      list: [{ id, name: DEFAULT_PORTFOLIO_NAME, privacy: "private" as const }],
      selectedId: id,
    };
  }, [portfolioSeedId]);

  const [portfolios, setPortfolios] = useState<PortfolioEntry[]>(portfolioSeed.list);
  const [selectedPortfolioId, setSelectedPortfolioState] = useState<string | null>(portfolioSeed.selectedId);

  const isFreePortfolioAccessible = useCallback(
    (portfolioId: string | null) => {
      if (!plan?.isFree || !portfolioId) return true;
      const entry = portfolios.find((p) => p.id === portfolioId);
      if (!entry) return true;
      if (portfolioIsDemo(entry)) return true;
      if (portfolioIsCombined(entry)) return false;
      // Brokerage (live or offline freeze): openable on Free as read-only offline.
      // Live links are demoted to offline async; still allow open while demoting.
      if (entry.snaptrade) return true;
      const manualCount = countManualPortfoliosForFreeQuota(portfolios);
      if (manualCount <= 1) return true;
      const active = plan.freeActivePortfolioId;
      // Invalid lock: free active must be a manual portfolio only.
      if (!active) return false;
      const activeEntry = portfolios.find((p) => p.id === active);
      if (!activeEntry || activeEntry.snaptrade || portfolioIsCombined(activeEntry) || portfolioIsDemo(activeEntry)) {
        return false;
      }
      return portfolioId === active;
    },
    [plan, portfolios],
  );

  const setSelectedPortfolioId = useCallback<Dispatch<SetStateAction<string | null>>>(
    (action) => {
      setSelectedPortfolioState((prev) => {
        const next = typeof action === "function" ? (action as (p: string | null) => string | null)(prev) : action;
        if (next != null && plan?.isFree && !isFreePortfolioAccessible(next)) {
          const entry = portfolios.find((p) => p.id === next);
          if (entry && portfolioIsCombined(entry)) {
            queueMicrotask(() => {
              toastProUpgrade({
                title: "Pro feature",
                description: "Combined portfolios are available on Pro only.",
                onUpgrade: openUpgradePlans,
              });
            });
            return prev;
          }
          if (plan.needsFreePortfolioPick) {
            queueMicrotask(() => setFreePortfolioPickOpen(true));
            return prev;
          }
          queueMicrotask(() => {
            toastProUpgrade({
              title: "Portfolio locked",
              description: "This portfolio is locked on Free. Upgrade to Pro to open it.",
              onUpgrade: openUpgradePlans,
            });
          });
          return prev;
        }
        if (next !== prev) saveLastSelectedPortfolioId(userId, next);
        return next;
      });
    },
    [userId, plan, isFreePortfolioAccessible, portfolios, openUpgradePlans],
  );

  const [editPortfolioOpen, setEditPortfolioOpen] = useState(false);
  const [editPortfolioId, setEditPortfolioId] = useState<string | null>(null);
  const [deletePortfolioConfirmId, setDeletePortfolioConfirmId] = useState<string | null>(null);
  const [createPortfolioOpen, setCreatePortfolioOpen] = useState(false);
  const [createPortfolioMode, setCreatePortfolioMode] = useState<CreatePortfolioMode>("manual");
  const [createCombinedOpen, setCreateCombinedOpen] = useState(false);
  const [connectBrokerageOpen, setConnectBrokerageOpen] = useState(false);
  const [snaptradeSyncPortfolioId, setSnaptradeSyncPortfolioId] = useState<string | null>(null);
  const [snaptradeSyncUpdating, setSnaptradeSyncUpdating] = useState(false);
  const [newTransactionOpen, setNewTransactionOpen] = useState(false);
  const [newTransactionPreset, setNewTransactionPreset] = useState<CompanyPick | null>(null);
  const [addCashModalOpen, setAddCashModalOpen] = useState(false);
  const [importTransactionsOpen, setImportTransactionsOpen] = useState(false);
  const [editTransaction, setEditTransaction] = useState<PortfolioTransaction | null>(null);
  const [holdingsByPortfolioId, setHoldingsByPortfolioId] = useState<Record<string, PortfolioHolding[]>>(
    {},
  );
  const [transactionsByPortfolioId, setTransactionsByPortfolioId] = useState<
    Record<string, PortfolioTransaction[]>
  >({});
  /** False until local + server merge has finished (avoids overwriting cloud with the default seed). */
  const [workspaceHydrated, setWorkspaceHydrated] = useState(false);
  /** True after we synchronously applied a local snapshot (fast path for repeat visits / post-login). */
  const [portfolioBootstrapFromLocal, setPortfolioBootstrapFromLocal] = useState(false);
  /**
   * False while {@link applyWorkspaceState} is waiting on {@link refreshHoldingMarketPrices}.
   * Starts true so empty / seed workspaces (no apply) still render immediately after hydrate.
   */
  const [holdingsMarkToMarketReady, setHoldingsMarkToMarketReady] = useState(true);
  const holdingsQuoteRefreshGenRef = useRef(0);
  const appliedLedgerFingerprintRef = useRef<string | null>(null);
  const quotedLedgerFingerprintRef = useRef<string | null>(null);
  /** Selection last covered by a deferred-route quote refresh (avoids duplicate fetches on hydrate). */
  const prevQuotedSelectionRef = useRef<string | null | undefined>(undefined);
  const QUOTE_DEDUPE_TTL_MS = 60_000;
  const quoteSessionKey = useMemo(() => `finsepa.portfolio.quotedLedger.${userId}`, [userId]);
  /** True after {@link applyWorkspaceState} skipped live quotes on a read-mostly route; cleared when catch-up runs. */
  const [deferredQuotesPending, setDeferredQuotesPending] = useState(false);
  const pathname = usePathname() ?? "";
  const pathnameRef = useRef(pathname);
  pathnameRef.current = pathname;

  const displayHoldingsByPortfolioId = useMemo(() => {
    const out: Record<string, PortfolioHolding[]> = { ...holdingsByPortfolioId };
    for (const p of portfolios) {
      if (!portfolioIsCombined(p)) continue;
      const from = p.combinedFrom ?? [];
      const lists = from
        .filter((sid) => portfolios.some((x) => x.id === sid && x.kind !== "combined"))
        .map((sid) => holdingsByPortfolioId[sid] ?? []);
      out[p.id] = mergeHoldingsBySymbol(lists);
    }
    return out;
  }, [portfolios, holdingsByPortfolioId]);

  const displayTransactionsByPortfolioId = useMemo(() => {
    const out: Record<string, PortfolioTransaction[]> = { ...transactionsByPortfolioId };
    for (const p of portfolios) {
      if (!portfolioIsCombined(p)) continue;
      const from = p.combinedFrom ?? [];
      const lists = from
        .filter((sid) => portfolios.some((x) => x.id === sid && x.kind !== "combined"))
        .map((sid) => transactionsByPortfolioId[sid] ?? []);
      out[p.id] = mergeTransactionsSorted(lists);
    }
    return out;
  }, [portfolios, transactionsByPortfolioId]);

  const selectedPortfolioReadOnly = useMemo(() => {
    const p = portfolios.find((x) => x.id === selectedPortfolioId);
    if (!p) return false;
    if (portfolioIsCombined(p)) return true;
    // Offline freezes always read-only until Pro reconnect clears offline.
    if (portfolioIsOfflineBrokerage(p)) return true;
    // Free: any brokerage book is view-only while demoting or offline.
    if (plan?.isFree && p.snaptrade) return true;
    return false;
  }, [portfolios, selectedPortfolioId, plan?.isFree]);

  const rebuildHoldingsFromSaved = useCallback((saved: PersistedPortfolioState) => {
    const rebuilt: Record<string, PortfolioHolding[]> = {};
    for (const p of saved.portfolios) {
      if (portfolioIsCombined(p)) continue;
      const txs = saved.transactionsByPortfolioId[p.id] ?? [];
      rebuilt[p.id] = replayTradeTransactionsToHoldings(txs);
    }
    return rebuilt;
  }, []);

  const runHoldingsQuoteRefresh = useCallback(
    (
      slice: Record<string, PortfolioHolding[]>,
      opts?: { recordQuotedLedger?: string },
    ) => {
      if (!Object.values(slice).some((h) => h.length > 0)) {
        setHoldingsMarkToMarketReady(true);
        return;
      }

      const refreshGen = ++holdingsQuoteRefreshGenRef.current;
      setHoldingsMarkToMarketReady(false);

      void (async () => {
        try {
          const quoted = await refreshHoldingsByPortfolioIdMarketPrices(slice);
          if (holdingsQuoteRefreshGenRef.current === refreshGen) {
            setHoldingsByPortfolioId((prev) => ({ ...prev, ...quoted }));
          }
          if (opts?.recordQuotedLedger && holdingsQuoteRefreshGenRef.current === refreshGen) {
            quotedLedgerFingerprintRef.current = opts.recordQuotedLedger;
            try {
              sessionStorage.setItem(
                quoteSessionKey,
                JSON.stringify({ ledger: opts.recordQuotedLedger, at: Date.now() }),
              );
            } catch {
              // ignore
            }
          }
        } finally {
          if (holdingsQuoteRefreshGenRef.current === refreshGen) {
            setHoldingsMarkToMarketReady(true);
          }
        }
      })();
    },
    [quoteSessionKey],
  );

  const scheduleHoldingsQuoteRefresh = useCallback(
    (
      rebuilt: Record<string, PortfolioHolding[]>,
      ledgerFingerprint: string,
      scope: { selectedPortfolioId: string | null; portfolios: PortfolioEntry[] },
    ) => {
      const eagerQuotes = portfolioPathnameUsesEagerLiveQuotes(pathnameRef.current);

      const skipForRecentSessionQuote = (): boolean => {
        try {
          const raw = sessionStorage.getItem(quoteSessionKey);
          if (raw) {
            const parsed = JSON.parse(raw) as { ledger: string; at: number } | null;
            if (
              parsed &&
              parsed.ledger === ledgerFingerprint &&
              typeof parsed.at === "number" &&
              Date.now() - parsed.at < QUOTE_DEDUPE_TTL_MS
            ) {
              quotedLedgerFingerprintRef.current = ledgerFingerprint;
              setHoldingsMarkToMarketReady(true);
              return true;
            }
          }
        } catch {
          // ignore
        }
        if (quotedLedgerFingerprintRef.current === ledgerFingerprint) {
          setHoldingsMarkToMarketReady(true);
          return true;
        }
        return false;
      };

      if (!eagerQuotes) {
        setDeferredQuotesPending(true);
        if (skipForRecentSessionQuote()) {
          prevQuotedSelectionRef.current = scope.selectedPortfolioId;
          return;
        }
        const topbarSlice = holdingsSliceForPortfolioLiveQuotes(
          rebuilt,
          scope.portfolios,
          scope.selectedPortfolioId,
        );
        quotedLedgerFingerprintRef.current = ledgerFingerprint;
        runHoldingsQuoteRefresh(topbarSlice, { recordQuotedLedger: ledgerFingerprint });
        prevQuotedSelectionRef.current = scope.selectedPortfolioId;
        return;
      }

      setDeferredQuotesPending(false);

      if (skipForRecentSessionQuote()) {
        return;
      }

      quotedLedgerFingerprintRef.current = ledgerFingerprint;
      runHoldingsQuoteRefresh(rebuilt, { recordQuotedLedger: ledgerFingerprint });
    },
    [quoteSessionKey, runHoldingsQuoteRefresh],
  );

  const applyWorkspaceState = useCallback(
    (saved: PersistedPortfolioState, opts?: { refreshQuotes?: boolean }) => {
      const ledgerFingerprint = portfolioLedgerFingerprint(saved);
      const rebuilt = rebuildHoldingsFromSaved(saved);

      if (appliedLedgerFingerprintRef.current !== ledgerFingerprint) {
        appliedLedgerFingerprintRef.current = ledgerFingerprint;

        setPortfolios(saved.portfolios);
        const lastTouched = loadLastSelectedPortfolioId(userId);
        const resolved = coalesceSelectedPortfolioId(
          saved.portfolios,
          saved.selectedPortfolioId,
          lastTouched,
        );
        setSelectedPortfolioState(resolved);
        saveLastSelectedPortfolioId(userId, resolved);
        setTransactionsByPortfolioId(saved.transactionsByPortfolioId);
        setHoldingsByPortfolioId(rebuilt);
      }

      if (opts?.refreshQuotes !== false) {
        const lastTouched = loadLastSelectedPortfolioId(userId);
        const resolvedSelected = coalesceSelectedPortfolioId(
          saved.portfolios,
          saved.selectedPortfolioId,
          lastTouched,
        );
        scheduleHoldingsQuoteRefresh(rebuilt, ledgerFingerprint, {
          selectedPortfolioId: resolvedSelected,
          portfolios: saved.portfolios,
        });
      }
    },
    [userId, rebuildHoldingsFromSaved, scheduleHoldingsQuoteRefresh],
  );

  /** Run deferred mark-to-market once when user lands on a portfolio-heavy route after a skipped hydrate. */
  useEffect(() => {
    if (!deferredQuotesPending) return;
    if (!portfolioPathnameUsesEagerLiveQuotes(pathname)) return;
    if (!workspaceHydrated && !portfolioBootstrapFromLocal) return;

    const rebuilt: Record<string, PortfolioHolding[]> = {};
    for (const p of portfolios) {
      if (portfolioIsCombined(p)) continue;
      rebuilt[p.id] = holdingsByPortfolioId[p.id] ?? [];
    }
    if (!Object.values(rebuilt).some((h) => h.length > 0)) {
      setDeferredQuotesPending(false);
      return;
    }

    setDeferredQuotesPending(false);
    const ledger = appliedLedgerFingerprintRef.current;
    runHoldingsQuoteRefresh(rebuilt, ledger ? { recordQuotedLedger: ledger } : undefined);
  }, [
    deferredQuotesPending,
    pathname,
    workspaceHydrated,
    portfolioBootstrapFromLocal,
    portfolios,
    holdingsByPortfolioId,
    runHoldingsQuoteRefresh,
  ]);

  /** On deferred routes, refresh quotes when the user switches portfolio in the top bar. */
  useEffect(() => {
    if (!workspaceHydrated && !portfolioBootstrapFromLocal) return;
    if (portfolioPathnameUsesEagerLiveQuotes(pathname)) {
      prevQuotedSelectionRef.current = selectedPortfolioId;
      return;
    }
    if (prevQuotedSelectionRef.current === selectedPortfolioId) return;

    prevQuotedSelectionRef.current = selectedPortfolioId;
    const slice = holdingsSliceForPortfolioLiveQuotes(
      holdingsByPortfolioId,
      portfolios,
      selectedPortfolioId,
    );
    runHoldingsQuoteRefresh(slice);
  }, [
    selectedPortfolioId,
    pathname,
    workspaceHydrated,
    portfolioBootstrapFromLocal,
    portfolios,
    holdingsByPortfolioId,
    runHoldingsQuoteRefresh,
  ]);

  /**
   * Demo seed uses early-2023 fill prices as provisional marks. Ensure the selected demo is
   * live-quoted even when hydrate skipped a refresh (session dedupe) or after first seed.
   */
  const demoLiveQuoteAttemptedRef = useRef(new Set<string>());
  useEffect(() => {
    if (!workspaceHydrated && !portfolioBootstrapFromLocal) return;
    if (!selectedPortfolioId) return;
    const selected = portfolios.find((p) => p.id === selectedPortfolioId);
    if (!selected || !portfolioIsDemo(selected)) return;
    if (demoLiveQuoteAttemptedRef.current.has(selectedPortfolioId)) return;
    const holds = holdingsByPortfolioId[selectedPortfolioId] ?? [];
    if (!holds.length) return;
    demoLiveQuoteAttemptedRef.current.add(selectedPortfolioId);
    runHoldingsQuoteRefresh({ [selectedPortfolioId]: holds });
  }, [
    selectedPortfolioId,
    portfolios,
    holdingsByPortfolioId,
    workspaceHydrated,
    portfolioBootstrapFromLocal,
    runHoldingsQuoteRefresh,
  ]);

  /** Instant balance from device cache; server merge still runs in the effect below. */
  useLayoutEffect(() => {
    setPortfolioBootstrapFromLocal(false);
    const local = loadPersistedPortfolioStateForUser(userId);
    if (local && local.portfolios.length > 0) {
      applyWorkspaceState(local, { refreshQuotes: true });
      setPortfolioBootstrapFromLocal(true);
    }
  }, [userId, applyWorkspaceState]);

  /** Load per-user local snapshot, merge with Supabase row, then allow debounced saves. */
  useEffect(() => {
    let cancelled = false;

    startTransition(() => {
      void (async () => {
        const local = loadPersistedPortfolioStateForUser(userId);
        const controller = new AbortController();
        let fetchTimeoutId: number | undefined;
        try {
          fetchTimeoutId = window.setTimeout(() => controller.abort(), 15_000);
          const res = await fetch("/api/portfolio/workspace", {
            credentials: "include",
            signal: controller.signal,
          });
          if (fetchTimeoutId !== undefined) {
            window.clearTimeout(fetchTimeoutId);
            fetchTimeoutId = undefined;
          }
          if (cancelled) return;
          if (res.ok) {
            const data = (await res.json()) as {
              state?: unknown;
              updatedAt?: string | null;
              warning?: string;
            };
            const remote =
              data.state != null ? parsePersistedPortfolioUnknown(data.state) : null;
            const remoteTime =
              data.updatedAt && !Number.isNaN(Date.parse(data.updatedAt)) ?
                Date.parse(data.updatedAt)
              : 0;
            const localTime = local?.savedAt ?? 0;

            if (remote && remote.portfolios.length > 0) {
              const localIsNewer =
                local && local.portfolios.length > 0 && localTime > remoteTime;
              const remoteHasLedger = portfolioStateHasLedgerData(remote);
              const localHasLedger = local ? portfolioStateHasLedgerData(local) : false;

              if (localIsNewer && remoteHasLedger && !localHasLedger) {
                applyWorkspaceState(remote);
                savePersistedPortfolioStateForUser(userId, {
                  ...remote,
                  savedAt: remoteTime > 0 ? remoteTime : Date.now(),
                });
            } else if (localIsNewer) {
                applyWorkspaceState(local);
                savePersistedPortfolioStateForUser(userId, local);
                const putRes = await fetch("/api/portfolio/workspace", {
                  method: "PUT",
                  credentials: "include",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ state: local }),
                });
                const putBody = (await putRes.json().catch(() => null)) as {
                  ok?: boolean;
                  warning?: string;
                } | null;
                if (!putRes.ok || putBody?.ok === false || putBody?.warning === "db_unavailable") {
                  toast.error("Portfolio not synced", {
                    description: "Saved on this device — we could not update your account yet.",
                  });
                }
              } else {
                applyWorkspaceState(remote);
                savePersistedPortfolioStateForUser(userId, {
                  ...remote,
                  savedAt: remoteTime > 0 ? remoteTime : Date.now(),
                });
              }
            } else if (local && local.portfolios.length > 0) {
              // Always promote local workspace when cloud has none — including empty
              // portfolios (no trades yet). Previously we only PUT when ledger data existed,
              // so multi-portfolio setups without trades never left the device.
              applyWorkspaceState(local);
              const putRes = await fetch("/api/portfolio/workspace", {
                method: "PUT",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ state: local }),
              });
              const putBody = (await putRes.json().catch(() => null)) as {
                ok?: boolean;
                warning?: string;
              } | null;
              if (!putRes.ok || putBody?.ok === false || putBody?.warning === "db_unavailable") {
                toast.error("Portfolio not synced", {
                  description: "Saved on this device — we could not update your account yet.",
                });
              }
            }
          } else if (local) {
            applyWorkspaceState(local);
          }
        } catch {
          if (local) applyWorkspaceState(local);
        } finally {
          if (fetchTimeoutId !== undefined) window.clearTimeout(fetchTimeoutId);
          if (!cancelled) setWorkspaceHydrated(true);
        }
      })();
    });

    return () => {
      cancelled = true;
    };
  }, [userId, applyWorkspaceState]);

  /** Immediate localStorage write so data survives fast sign-out / navigation (debounce cancel). */
  useEffect(() => {
    if (!workspaceHydrated) return;
    const snapshot: PersistedPortfolioState = {
      v: 1,
      savedAt: Date.now(),
      portfolios,
      selectedPortfolioId,
      holdingsByPortfolioId,
      transactionsByPortfolioId,
    };
    // First session (no remote/local hydrate) never called applyWorkspaceState, so the
    // fingerprint stayed null and saves were skipped — portfolios vanished on refresh.
    if (appliedLedgerFingerprintRef.current === null) {
      appliedLedgerFingerprintRef.current = portfolioLedgerFingerprint(snapshot);
    }
    savePersistedPortfolioStateForUser(userId, snapshot);
  }, [
    workspaceHydrated,
    userId,
    portfolios,
    selectedPortfolioId,
    holdingsByPortfolioId,
    transactionsByPortfolioId,
  ]);

  /** Debounced cloud sync (local is already up to date via effect above). */
  useEffect(() => {
    if (!workspaceHydrated) return;
    const id = window.setTimeout(() => {
      const snapshot: PersistedPortfolioState = {
        v: 1,
        savedAt: Date.now(),
        portfolios,
        selectedPortfolioId,
        holdingsByPortfolioId,
        transactionsByPortfolioId,
      };
      if (appliedLedgerFingerprintRef.current === null) {
        appliedLedgerFingerprintRef.current = portfolioLedgerFingerprint(snapshot);
      }
      const { state: prepared, report } = prepareWorkspaceLedgerForPersist(snapshot);
      if (report.changed) {
        setTransactionsByPortfolioId(prepared.transactionsByPortfolioId);
      }
      void fetch("/api/portfolio/workspace", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ state: prepared }),
      }).then(async (res) => {
        if (res.status === 422) {
          const body = (await res.json().catch(() => null)) as {
            message?: string;
            code?: string;
          } | null;
          toast.error("Portfolio not synced", {
            description: body?.message ?? "Ledger validation failed on the server.",
          });
          return;
        }
        if (res.status === 403) {
          const body = (await res.json().catch(() => null)) as {
            code?: string;
            message?: string;
            max?: number;
          } | null;
          if (body?.code === FREE_HOLDINGS_LIMIT_CODE) {
            toastProUpgrade({
              title: "Free plan limit",
              description: body.message ?? freeHoldingsLimitMessage(body.max),
              onUpgrade: () => router.push(PATH_ACCOUNT_PLANS),
            });
            return;
          }
        }
        const body = (await res.json().catch(() => null)) as {
          ok?: boolean;
          warning?: string;
        } | null;
        if (!res.ok || body?.ok === false || body?.warning === "db_unavailable") {
          toast.error("Portfolio not synced", {
            description: "Saved on this device — we could not update your account yet.",
          });
        }
      });
    }, 500);
    return () => window.clearTimeout(id);
  }, [
    workspaceHydrated,
    userId,
    portfolios,
    selectedPortfolioId,
    holdingsByPortfolioId,
    transactionsByPortfolioId,
    router,
  ]);

  const prevPublishedPortfolioIdsRef = useRef<Set<string>>(new Set());
  /** One attempt per user session: publish public portfolios to Supabase right after hydrate (table row for /portfolios). */
  const attemptedHydratePublicListingSyncRef = useRef(false);

  const syncPublicPortfolioListings = useCallback(
    async (opts?: { unpublishRemoved?: boolean }) => {
      const publicListed = portfolios.filter(
        (p) => p.privacy === "public" && (p.kind !== "combined" || portfolioIsCombined(p)),
      );
      const current = new Set(publicListed.map((p) => p.id));
      const prev = prevPublishedPortfolioIdsRef.current;

      let listingsUpdated = false;

      if (opts?.unpublishRemoved !== false) {
        for (const id of prev) {
          if (current.has(id)) continue;
          try {
            const res = await fetch("/api/portfolios/listings", {
              method: "PUT",
              credentials: "include",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ portfolioId: id, publish: false }),
            });
            const data = (await res.json()) as { ok?: boolean; warning?: string };
            if (res.ok && data.ok !== false && data.warning !== "db_unavailable") listingsUpdated = true;
          } catch {
            /* ignore */
          }
        }
      }

      if (publicListed.length > 0) {
        const slice: Record<string, PortfolioHolding[]> = {};
        for (const p of publicListed) {
          slice[p.id] = displayHoldingsByPortfolioId[p.id] ?? [];
        }
        const quotedByPortfolioId = await refreshHoldingsByPortfolioIdMarketPrices(slice);

        for (const p of publicListed) {
          const holdings = quotedByPortfolioId[p.id] ?? [];
          const txs = displayTransactionsByPortfolioId[p.id] ?? [];
          const metrics = metricsForPublicListing(holdings, txs);
          try {
            const res = await fetch("/api/portfolios/listings", {
              method: "PUT",
              credentials: "include",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                portfolioId: p.id,
                displayName: p.name,
                publish: true,
                metrics,
              }),
            });
            const data = (await res.json()) as { ok?: boolean; warning?: string };
            if (res.ok && data.ok !== false && data.warning !== "db_unavailable") listingsUpdated = true;
          } catch {
            /* ignore */
          }
        }
      }

      prevPublishedPortfolioIdsRef.current = new Set(current);
      if (listingsUpdated) dispatchPublicListingsChanged();
    },
    [portfolios, displayHoldingsByPortfolioId, displayTransactionsByPortfolioId, metricsForPublicListing],
  );

  useEffect(() => {
    attemptedHydratePublicListingSyncRef.current = false;
  }, [userId]);

  useEffect(() => {
    if (!workspaceHydrated || !holdingsMarkToMarketReady) return;
    const publicListed = portfolios.filter(
      (p) => p.privacy === "public" && (p.kind !== "combined" || portfolioIsCombined(p)),
    );
    if (publicListed.length === 0) return;
    if (attemptedHydratePublicListingSyncRef.current) return;

    attemptedHydratePublicListingSyncRef.current = true;
    void syncPublicPortfolioListings({ unpublishRemoved: false });
  }, [
    workspaceHydrated,
    holdingsMarkToMarketReady,
    portfolios,
    syncPublicPortfolioListings,
  ]);

  /** Sync Supabase community listings when public standard portfolios change (debounced). */
  useEffect(() => {
    if (!workspaceHydrated || !holdingsMarkToMarketReady) return;
    const tid = window.setTimeout(() => {
      void syncPublicPortfolioListings({ unpublishRemoved: true });
    }, 600);
    return () => window.clearTimeout(tid);
  }, [
    workspaceHydrated,
    holdingsMarkToMarketReady,
    portfolios,
    displayHoldingsByPortfolioId,
    displayTransactionsByPortfolioId,
    syncPublicPortfolioListings,
  ]);

  /** Replaces the row for the same ticker, or appends — supports merged positions after multiple buys. */
  const addHolding = useCallback(
    (portfolioId: string, holding: PortfolioHolding) => {
      const port = portfolios.find((x) => x.id === portfolioId);
      if (port?.kind === "combined") return;
      setHoldingsByPortfolioId((prev) => {
      const list = [...(prev[portfolioId] ?? [])];
      const sym = holding.symbol.toUpperCase();
      const idx = list.findIndex((h) => h.symbol.toUpperCase() === sym);
      if (idx === -1) list.push(holding);
      else list[idx] = holding;
      return { ...prev, [portfolioId]: list };
    });
    },
    [portfolios],
  );

  const addTransaction = useCallback(
    (portfolioId: string, transaction: PortfolioTransaction) => {
      const port = portfolios.find((x) => x.id === portfolioId);
      if (port?.kind === "combined") return;
      const list = transactionsByPortfolioId[portfolioId] ?? [];
      const stamped = stampNewTransaction(list, transaction);
      const next = [...list, stamped];
      const validation = validatePortfolioLedgerMutation(portfolioId, next);
      if (!validation.ok) {
        const first = validation.errors[0];
        toast.error("Transaction rejected", {
          description: first?.message ?? "This transaction would make the portfolio invalid.",
        });
        return;
      }
      setTransactionsByPortfolioId((prev) => ({
        ...prev,
        [portfolioId]: next,
      }));
    },
    [portfolios, transactionsByPortfolioId],
  );

  const setPortfolioTransactions = useCallback(
    (portfolioId: string, transactions: PortfolioTransaction[]) => {
      const port = portfolios.find((x) => x.id === portfolioId);
      if (port?.kind === "combined") return;
      const validation = validatePortfolioLedgerMutation(portfolioId, transactions);
      if (!validation.ok) {
        const first = validation.errors[0];
        toast.error("Change rejected", {
          description: first?.message ?? "This change would make the portfolio invalid.",
        });
        return;
      }
      const { transactions: migrated } = migratePortfolioTransactionSequences(transactions);
      setTransactionsByPortfolioId((prev) => ({ ...prev, [portfolioId]: migrated }));
    },
    [portfolios],
  );

  const setPortfolioHoldings = useCallback(
    (portfolioId: string, holdings: PortfolioHolding[]) => {
      const port = portfolios.find((x) => x.id === portfolioId);
      if (port?.kind === "combined") return;
      setHoldingsByPortfolioId((prev) => ({ ...prev, [portfolioId]: holdings }));
    },
    [portfolios],
  );

  /** Continuous-price ledger repair (strip auto CA splits / reverse as-traded heals). Silent. */
  const stockSplitsFpRef = useRef(new Map<string, string>());
  const stockSplitsInFlightRef = useRef(new Set<string>());
  const demoDividendsAppliedRef = useRef(new Set<string>());

  /** Demo-only: seed cash dividends into the ledger so Transactions + value include income. */
  const ensureDemoDividendsForPortfolio = useCallback(
    async (portfolioId: string, txsOverride?: PortfolioTransaction[]) => {
      const port = portfolios.find((x) => x.id === portfolioId);
      if (!port || !portfolioIsDemo(port)) return;
      if (demoDividendsAppliedRef.current.has(portfolioId)) return;

      const txs = txsOverride ?? transactionsByPortfolioId[portfolioId] ?? [];
      // Wait until ledger is present (hydrate can land demo before txs).
      if (txs.length === 0) return;

      const next = ensureDemoDividendTransactions(portfolioId, txs);
      if (next) {
        demoDividendsAppliedRef.current.add(portfolioId);
        setPortfolioTransactions(portfolioId, next);
        const rebuilt = replayTradeTransactionsToHoldings(next);
        const quoted = await refreshHoldingMarketPrices(rebuilt);
        setPortfolioHoldings(portfolioId, quoted);
        return;
      }

      // Already has dividends (or none owed) — don't keep retrying every render.
      demoDividendsAppliedRef.current.add(portfolioId);
    },
    [portfolios, transactionsByPortfolioId, setPortfolioTransactions, setPortfolioHoldings],
  );

  const ledgerTxFingerprint = useCallback((txs: readonly PortfolioTransaction[]) => {
    return txs
      .map((t) => `${t.id}|${t.date}|${t.operation}|${t.symbol}|${t.shares}|${t.price}|${t.sum}`)
      .join(";");
  }, []);

  const syncStockSplitsForPortfolio = useCallback(
    async (portfolioId: string, txsOverride?: PortfolioTransaction[]) => {
      const port = portfolios.find((x) => x.id === portfolioId);
      if (!port || portfolioIsCombined(port) || port.snaptrade) return;
      if (stockSplitsInFlightRef.current.has(portfolioId)) return;

      const txs = txsOverride ?? transactionsByPortfolioId[portfolioId] ?? [];
      if (!txs.some((t) => t.kind === "trade")) return;

      const fp = `continuous-v3|${ledgerTxFingerprint(txs)}`;
      if (stockSplitsFpRef.current.get(portfolioId) === fp) return;

      stockSplitsInFlightRef.current.add(portfolioId);
      try {
        const res = await fetch("/api/portfolio/stock-splits", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ portfolioId, transactions: txs }),
        });
        if (!res.ok) return;
        const data = (await res.json()) as {
          transactions?: PortfolioTransaction[];
          pricesHealed?: number;
          pricesRestored?: number;
          splitsRemoved?: number;
        };
        const pricesRestored =
          typeof data.pricesRestored === "number" ? data.pricesRestored
          : typeof data.pricesHealed === "number" ? data.pricesHealed
          : 0;
        const splitsRemoved = typeof data.splitsRemoved === "number" ? data.splitsRemoved : 0;
        const nextRaw =
          Array.isArray(data.transactions) && data.transactions.length > 0
            ? data.transactions
            : txs;

        // No repair needed — remember this ledger shape so we don't poll again every effect.
        if (pricesRestored === 0 && splitsRemoved === 0) {
          stockSplitsFpRef.current.set(portfolioId, fp);
          return;
        }

        // Bypass strict mutation validation (orphan sells etc. already in display ledger).
        const tagged = tagLegacyAnomalySells(nextRaw, portfolioId);
        const { transactions: migrated } = migratePortfolioTransactionSequences(tagged.transactions);
        stockSplitsFpRef.current.set(portfolioId, `continuous-v3|${ledgerTxFingerprint(migrated)}`);
        setTransactionsByPortfolioId((prev) => ({ ...prev, [portfolioId]: migrated }));
        const rebuilt = replayTradeTransactionsToHoldings(migrated);
        const quoted = await refreshHoldingMarketPrices(rebuilt);
        setPortfolioHoldings(portfolioId, quoted);
      } catch {
        /* non-fatal */
      } finally {
        stockSplitsInFlightRef.current.delete(portfolioId);
      }
    },
    [portfolios, transactionsByPortfolioId, ledgerTxFingerprint, setPortfolioHoldings],
  );

  /**
   * Replace outdated demo ledgers (e.g. NFLX as-traded seed prices / partial adj-heal)
   * with the current continuous-scale seed, keeping the same portfolio id.
   */
  const reseedDemoLedgerIfNeeded = useCallback(
    (portfolioId: string): boolean => {
      const port = portfolios.find((x) => x.id === portfolioId);
      if (!port || !portfolioIsDemo(port)) return false;
      if (demoReseedDoneRef.current.has(portfolioId)) return false;

      const txs = transactionsByPortfolioId[portfolioId] ?? [];
      if (txs.length === 0) return false;
      if (!demoLedgerNeedsReseed(txs)) {
        demoReseedDoneRef.current.add(portfolioId);
        return false;
      }

      demoReseedDoneRef.current.add(portfolioId);
      const seed = buildDemoPortfolioSeed(portfolioId);
      setPortfolioHoldings(portfolioId, seed.holdings);
      setPortfolioTransactions(portfolioId, seed.transactions);
      demoDividendsAppliedRef.current.add(portfolioId);
      // Clear split-sync fingerprint so continuous repair runs on the new ledger.
      stockSplitsFpRef.current.delete(portfolioId);
      runHoldingsQuoteRefresh({ [portfolioId]: seed.holdings });
      void syncStockSplitsForPortfolio(portfolioId, seed.transactions);
      return true;
    },
    [
      portfolios,
      transactionsByPortfolioId,
      setPortfolioHoldings,
      setPortfolioTransactions,
      runHoldingsQuoteRefresh,
      syncStockSplitsForPortfolio,
    ],
  );

  useEffect(() => {
    if (!workspaceHydrated && !portfolioBootstrapFromLocal) return;
    for (const p of portfolios) {
      if (portfolioIsDemo(p)) {
        if (reseedDemoLedgerIfNeeded(p.id)) continue;
        void ensureDemoDividendsForPortfolio(p.id);
      }
      if (portfolioIsCombined(p) || p.snaptrade) continue;
      void syncStockSplitsForPortfolio(p.id);
    }
  }, [
    workspaceHydrated,
    portfolioBootstrapFromLocal,
    portfolios,
    transactionsByPortfolioId,
    syncStockSplitsForPortfolio,
    ensureDemoDividendsForPortfolio,
    reseedDemoLedgerIfNeeded,
  ]);

  const openTryDemoPortfolio = useCallback(() => {
    if (portfolios.some((p) => portfolioIsDemo(p))) {
      const existing = portfolios.find((p) => portfolioIsDemo(p));
      if (existing) {
        setSelectedPortfolioId(existing.id);
        if (!reseedDemoLedgerIfNeeded(existing.id)) {
          // Seed marks are historic fill prices — always re-mark to market when focusing demo.
          runHoldingsQuoteRefresh({
            [existing.id]: holdingsByPortfolioId[existing.id] ?? [],
          });
          void ensureDemoDividendsForPortfolio(existing.id);
          void syncStockSplitsForPortfolio(existing.id);
        }
      }
      toast.message("Finsepa Demo is already in your list.");
      return;
    }
    if (demoSeededRef.current) return;
    demoSeededRef.current = true;
    const seed = buildDemoPortfolioSeed();
    setPortfolios((prev) => [...prev, seed.portfolio]);
    setPortfolioHoldings(seed.portfolio.id, seed.holdings);
    setPortfolioTransactions(seed.portfolio.id, seed.transactions);
    setSelectedPortfolioId(seed.portfolio.id);
    demoDividendsAppliedRef.current.add(seed.portfolio.id);
    // Holdings are provisionally last-fill (early 2023) until live quotes / split sync land.
    runHoldingsQuoteRefresh({ [seed.portfolio.id]: seed.holdings });
    void syncStockSplitsForPortfolio(seed.portfolio.id, seed.transactions);
    toast.success("Finsepa Demo added — explore sample holdings anytime.");
  }, [
    portfolios,
    holdingsByPortfolioId,
    setSelectedPortfolioId,
    setPortfolioHoldings,
    setPortfolioTransactions,
    runHoldingsQuoteRefresh,
    syncStockSplitsForPortfolio,
    ensureDemoDividendsForPortfolio,
    reseedDemoLedgerIfNeeded,
  ]);

  /**
   * Free: always keep a Demo sample book (does not count toward the 1 manual slot).
   * New signups land on Demo; empty "My Portfolio" placeholders are removed so Free starts as Demo-only.
   */
  useEffect(() => {
    if (!workspaceHydrated) return;
    if (plan?.isFree !== true) return;
    if (!plan.selectionReady) return;

    const existingDemo = portfolios.find((p) => portfolioIsDemo(p));
    if (existingDemo) {
      reseedDemoLedgerIfNeeded(existingDemo.id);
      const hasManual = portfolios.some((p) => isManualPortfolioForFreeQuota(p));
      const selected = portfolios.find((p) => p.id === selectedPortfolioId);
      // Free with Demo only — keep Demo selected (don't force off a real manual book).
      if (!hasManual && (!selected || !portfolioIsDemo(selected))) {
        if (selectedPortfolioId !== existingDemo.id) {
          setSelectedPortfolioId(existingDemo.id);
        }
      }
      return;
    }

    if (demoSeededRef.current) return;
    demoSeededRef.current = true;

    const seed = buildDemoPortfolioSeed();
    const emptyPlaceholderIds = new Set(
      portfolios
        .filter((p) => {
          if (!isManualPortfolioForFreeQuota(p)) return false;
          const txs = transactionsByPortfolioId[p.id] ?? [];
          const holds = holdingsByPortfolioId[p.id] ?? [];
          return txs.length === 0 && holds.length === 0;
        })
        .map((p) => p.id),
    );

    setPortfolios((prev) => [
      ...prev.filter((p) => !emptyPlaceholderIds.has(p.id)),
      seed.portfolio,
    ]);
    setHoldingsByPortfolioId((prev) => {
      const next = { ...prev };
      for (const id of emptyPlaceholderIds) delete next[id];
      next[seed.portfolio.id] = seed.holdings;
      return next;
    });
    setTransactionsByPortfolioId((prev) => {
      const next = { ...prev };
      for (const id of emptyPlaceholderIds) delete next[id];
      next[seed.portfolio.id] = seed.transactions;
      return next;
    });
    demoDividendsAppliedRef.current.add(seed.portfolio.id);
    setSelectedPortfolioId(seed.portfolio.id);
    runHoldingsQuoteRefresh({ [seed.portfolio.id]: seed.holdings });
    void syncStockSplitsForPortfolio(seed.portfolio.id, seed.transactions);
  }, [
    workspaceHydrated,
    plan?.isFree,
    plan?.selectionReady,
    portfolios,
    selectedPortfolioId,
    holdingsByPortfolioId,
    transactionsByPortfolioId,
    setSelectedPortfolioId,
    runHoldingsQuoteRefresh,
    syncStockSplitsForPortfolio,
    reseedDemoLedgerIfNeeded,
  ]);

  const openEditTransaction = useCallback(
    (t: PortfolioTransaction) => {
      const p = portfolios.find((x) => x.id === selectedPortfolioId);
      if (p?.kind === "combined") return;
      if (isSnaptradeBrokerRow(t)) {
        toast.error("This transaction is read-only", {
          description: "Rows imported from your broker are read-only and managed by sync.",
        });
        return;
      }
      setSelectedPortfolioId(t.portfolioId);
      setEditTransaction(t);
    },
    [portfolios, selectedPortfolioId],
  );

  const closeEditTransaction = useCallback(() => {
    setEditTransaction(null);
  }, []);

  const removePortfolioTransactions = useCallback(
    async (portfolioId: string, ids: ReadonlySet<string>) => {
      if (ids.size === 0) return;
      const port = portfolios.find((x) => x.id === portfolioId);
      if (port?.kind === "combined") return;
      const list = transactionsByPortfolioId[portfolioId] ?? [];
      const targeted = list.filter((x) => ids.has(x.id));
      if (targeted.some((x) => isSnaptradeBrokerRow(x))) {
        toast.error("Imported transactions can't be deleted", {
          description: "Broker imports are managed by sync.",
        });
        return;
      }
      const next = list.filter((x) => !ids.has(x.id));
      const validation = validatePortfolioLedgerMutation(portfolioId, next);
      if (!validation.ok) {
        const first = validation.errors[0];
        toast.error("Delete rejected", {
          description: first?.message ?? "Removing this transaction would invalidate a later sell.",
        });
        return;
      }
      setPortfolioTransactions(portfolioId, next);
      setEditTransaction((cur) => (cur && ids.has(cur.id) ? null : cur));
      const rebuilt = replayTradeTransactionsToHoldings(next);
      const quoted = await refreshHoldingMarketPrices(rebuilt);
      setPortfolioHoldings(portfolioId, quoted);
    },
    [portfolios, setPortfolioHoldings, setPortfolioTransactions, transactionsByPortfolioId],
  );

  const removePortfolioTransaction = useCallback(
    async (t: PortfolioTransaction) => {
      const view = portfolios.find((x) => x.id === selectedPortfolioId);
      if (view?.kind === "combined") return;
      await removePortfolioTransactions(t.portfolioId, new Set([t.id]));
    },
    [portfolios, selectedPortfolioId, removePortfolioTransactions],
  );

  const restorePortfolioTransaction = useCallback(
    async (t: PortfolioTransaction) => {
      const view = portfolios.find((x) => x.id === selectedPortfolioId);
      if (view?.kind === "combined") return;
      const pid = t.portfolioId;
      const list = transactionsByPortfolioId[pid] ?? [];
      if (list.some((x) => x.id === t.id)) return;
      const next = [...list, t].sort((a, b) => {
        if (a.date !== b.date) return a.date.localeCompare(b.date);
        return 0;
      });
      setPortfolioTransactions(pid, next);
      const rebuilt = replayTradeTransactionsToHoldings(next);
      const quoted = await refreshHoldingMarketPrices(rebuilt);
      setPortfolioHoldings(pid, quoted);
    },
    [portfolios, selectedPortfolioId, setPortfolioHoldings, setPortfolioTransactions, transactionsByPortfolioId],
  );

  const openEditPortfolio = useCallback(
    (id: string) => {
      if (plan?.isFree && !isFreePortfolioAccessible(id)) {
        const entry = portfolios.find((p) => p.id === id);
        if (entry && portfolioIsCombined(entry)) {
          toastProUpgrade({
            title: "Pro feature",
            description: "Combined portfolios are available on Pro only.",
            onUpgrade: openUpgradePlans,
          });
          return;
        }
        toastProUpgrade({
          title: "Portfolio locked",
          description: "This portfolio is locked on Free. Upgrade to Pro to edit it.",
          onUpgrade: openUpgradePlans,
        });
        return;
      }
      setCreatePortfolioOpen(false);
      setCreateCombinedOpen(false);
      setEditPortfolioId(id);
      setEditPortfolioOpen(true);
    },
    [plan, isFreePortfolioAccessible, portfolios, openUpgradePlans],
  );

  const openCreatePortfolio = useCallback((options?: { mode?: CreatePortfolioMode }) => {
    if (options?.mode === "brokerage" && plan && !plan.canConnectBrokerage) {
      toastProUpgrade({
        title: "Pro feature",
        description: "Brokerage connection is available on Pro only.",
        onUpgrade: openUpgradePlans,
      });
      return;
    }
    if (plan?.isFree && !plan.canCreatePortfolio) {
      toastProUpgrade({
        title: "Free plan limit",
        description: "Free includes Demo + 1 manual portfolio. Upgrade to Pro to add more.",
        onUpgrade: openUpgradePlans,
      });
      return;
    }
    setEditPortfolioOpen(false);
    setEditPortfolioId(null);
    setCreateCombinedOpen(false);
    setCreatePortfolioMode(options?.mode === "brokerage" ? "brokerage" : "manual");
    setCreatePortfolioOpen(true);
  }, [plan, openUpgradePlans]);

  const openCreateCombinedPortfolio = useCallback(() => {
    if (plan && !plan.canCreateCombinedPortfolio) {
      toastProUpgrade({
        title: "Pro feature",
        description: "Combined portfolios are available on Pro only.",
        onUpgrade: openUpgradePlans,
      });
      return;
    }
    setEditPortfolioOpen(false);
    setEditPortfolioId(null);
    setCreatePortfolioOpen(false);
    setConnectBrokerageOpen(false);
    setCreateCombinedOpen(true);
  }, [plan, openUpgradePlans]);

  const openConnectBrokerage = useCallback(() => {
    if (plan && !plan.canConnectBrokerage) {
      toastProUpgrade({
        title: "Pro feature",
        description: "Brokerage connection is available on Pro only.",
        onUpgrade: openUpgradePlans,
      });
      return;
    }
    setEditPortfolioOpen(false);
    setEditPortfolioId(null);
    setCreatePortfolioOpen(false);
    setCreateCombinedOpen(false);
    setConnectBrokerageOpen(true);
  }, [plan, openUpgradePlans]);

  const openSnaptradeSyncModal = useCallback(
    (portfolioId: string) => {
      if (plan && !plan.canConnectBrokerage) {
        toastProUpgrade({
          title: "Pro feature",
          description: "Brokerage sync requires Pro. Upgrade to reconnect and sync.",
          onUpgrade: openUpgradePlans,
        });
        return;
      }
      setSnaptradeSyncPortfolioId(portfolioId);
    },
    [plan, openUpgradePlans],
  );

  const closeSnaptradeSyncModal = useCallback(() => {
    if (snaptradeSyncUpdating) return;
    setSnaptradeSyncPortfolioId(null);
  }, [snaptradeSyncUpdating]);

  type SnapTradeSyncApiResponse = {
    error?: string;
    authorizationId?: string;
    brokerageName?: string | null;
    brokerageSlug?: string | null;
    brokerageLogoUrl?: string | null;
    isRealTimeConnection?: boolean;
    accountIds?: string[];
    transactions?: Omit<PortfolioTransaction, "id" | "portfolioId">[];
    warnings?: Array<{ code?: string; message?: string }>;
    reconciliation?: unknown;
    brokerMarks?: Record<string, number>;
  };

  const applySnapTradeSyncToPortfolio = useCallback(
    async (
      portfolioId: string,
      authorizationId: string,
      data: SnapTradeSyncApiResponse,
      options?: { updateFromYmd?: string | null; existingTransactions?: PortfolioTransaction[] },
    ) => {
      const draftTxs = Array.isArray(data.transactions) ? data.transactions : [];
      // Broker draft rows carry SnapTrade provenance from the server; stamp local ids + portfolio.
      const incoming: PortfolioTransaction[] = draftTxs.map((row) => ({
        ...row,
        id: newTransactionRowId(),
        portfolioId,
      }));

      const updateFrom = options?.updateFromYmd ?? null;
      // Normalize provenance (missing source ⇒ MANUAL) BEFORE the safe merge.
      const existing = normalizeTransactionsProvenance(options?.existingTransactions ?? []);

      // Phase 5B: safe merge. Full history ("first transaction") replaces stale broker rows;
      // incremental Update-from only upserts/adds in-window rows and preserves the rest.
      const { transactions } = mergeSnaptradeSyncSafe({
        existing,
        incoming,
        updateFromYmd: updateFrom,
        replaceMissingBrokerRows: updateFrom == null,
      });

      setPortfolioTransactions(portfolioId, transactions);
      const rebuilt = replayTradeTransactionsToHoldings(transactions);
      const quoted = await refreshHoldingMarketPrices(rebuilt, data.brokerMarks, {
        // Connected portfolios: brokerage marks are the sync source of truth for MV.
        preferFallback: Boolean(data.brokerMarks && Object.keys(data.brokerMarks).length > 0),
      });
      setPortfolioHoldings(portfolioId, quoted);

      setPortfolios((prev) =>
        prev.map((p) =>
          p.id !== portfolioId ?
            p
          : {
              ...p,
              snaptrade: {
                authorizationId: data.authorizationId ?? authorizationId,
                accountIds: Array.isArray(data.accountIds) ? data.accountIds : (p.snaptrade?.accountIds ?? []),
                brokerageName: data.brokerageName ?? p.snaptrade?.brokerageName ?? null,
                brokerageSlug: data.brokerageSlug ?? p.snaptrade?.brokerageSlug ?? null,
                brokerageLogoUrl: data.brokerageLogoUrl ?? p.snaptrade?.brokerageLogoUrl ?? null,
                isRealTimeConnection:
                  data.isRealTimeConnection === true ?
                    true
                  : data.isRealTimeConnection === false ?
                    false
                  : (p.snaptrade?.isRealTimeConnection ?? false),
                syncedAt: new Date().toISOString(),
                ...(p.snaptrade?.syncSettings ? { syncSettings: p.snaptrade.syncSettings } : {}),
              },
            },
        ),
      );

      return { quoted, transactions, warnings: data.warnings ?? [] };
    },
    [setPortfolioHoldings, setPortfolioTransactions],
  );

  const resyncLinkedPortfolio = useCallback(
    async (
      portfolioId: string,
      options?: { silent?: boolean; updateFromYmd?: string | null; authorizationIdOverride?: string },
    ) => {
      if (plan && !plan.canConnectBrokerage) {
        if (options?.silent !== true) {
          toastProUpgrade({
            title: "Pro feature",
            description: "Brokerage sync requires Pro. Upgrade to reconnect and sync.",
            onUpgrade: openUpgradePlans,
          });
        }
        return;
      }
      const portfolio = portfolios.find((p) => p.id === portfolioId);
      const authorizationId =
        options?.authorizationIdOverride?.trim() ||
        (portfolio?.snaptrade?.offline ? "" : portfolio?.snaptrade?.authorizationId?.trim()) ||
        "";
      if (!portfolio || !authorizationId || authorizationId === "offline") {
        if (options?.silent !== true) {
          toastProUpgrade({
            title: "Pro feature",
            description: "Reconnect this brokerage on Pro to sync again.",
            onUpgrade: openUpgradePlans,
          });
        }
        return;
      }

      const syncSettings = DEFAULT_PORTFOLIO_SNAPTRADE_SYNC_SETTINGS;
      const existingTransactions = transactionsByPortfolioId[portfolioId] ?? [];
      const updateFromYmd =
        options?.updateFromYmd !== undefined ?
          options.updateFromYmd
        : defaultSnaptradeUpdateFromYmd(existingTransactions);
      const silent = options?.silent === true;
      const toastId = silent ? undefined : toast.loading("Syncing brokerage…");
      try {
        const res = await fetch("/api/snaptrade/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ authorizationId, syncSettings, updateFromYmd }),
        });
        const data = (await res.json()) as SnapTradeSyncApiResponse;
        if (!res.ok) {
          throw new Error(data.error ?? "Failed to sync brokerage.");
        }

        const { quoted, transactions, warnings } = await applySnapTradeSyncToPortfolio(
          portfolioId,
          authorizationId,
          data,
          { updateFromYmd, existingTransactions },
        );

        if (!silent) {
          const isRealTime = data.isRealTimeConnection === true;
          const mismatchWarnings = warnings.filter(
            (w) =>
              w.code === "CASH_MISMATCH" ||
              w.code === "POSITION_MISMATCH" ||
              w.code === "CASH_BRIDGE" ||
              w.code === "POSITION_BRIDGE" ||
              w.code === "HISTORY_INCOMPLETE",
          );
          const warningLine =
            mismatchWarnings.length > 0 ?
              mismatchWarnings
                .slice(0, 2)
                .map((w) => w.message)
                .filter(Boolean)
                .join(" ")
            : null;
          toast.success(`"${portfolio.name}" synced from ${data.brokerageName ?? "brokerage"}.`, {
            id: toastId,
            description:
              warningLine ?
                warningLine
              : isRealTime ? "Holdings and cash updated from SnapTrade."
              : "Used SnapTrade daily cache (no extra refresh charge). Data may be up to 24h old.",
          });
        }

        if (portfolio.privacy === "public") {
          void putPublicPortfolioListingRequest({
            portfolioId,
            publish: true,
            displayName: portfolio.name,
            metrics: metricsForPublicListing(quoted, transactions),
          }).then((r) => {
            if (r.ok) dispatchPublicListingsChanged();
          });
        }
      } catch (e) {
        const message = e instanceof Error ? e.message : "Failed to sync brokerage.";
        if (!silent) {
          toast.error(message, { id: toastId });
        }
        throw e;
      }
    },
    [
      applySnapTradeSyncToPortfolio,
      metricsForPublicListing,
      openUpgradePlans,
      plan,
      portfolios,
      transactionsByPortfolioId,
    ],
  );

  const autoSyncInFlightRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const MS_DAY = 24 * 60 * 60 * 1000;
    const now = Date.now();
    if (plan && !plan.canConnectBrokerage) return;

    for (const portfolio of portfolios) {
      if (!portfolioIsLiveBrokerage(portfolio)) continue;
      const authorizationId = portfolio.snaptrade?.authorizationId;
      if (!authorizationId) continue;

      const syncedAtMs = Date.parse(portfolio.snaptrade?.syncedAt ?? "");
      if (!Number.isFinite(syncedAtMs) || now - syncedAtMs < MS_DAY) continue;
      if (autoSyncInFlightRef.current.has(portfolio.id)) continue;

      autoSyncInFlightRef.current.add(portfolio.id);
      void resyncLinkedPortfolio(portfolio.id, { silent: true })
        .catch(() => {
          /* toast shown in resyncLinkedPortfolio */
        })
        .finally(() => {
          autoSyncInFlightRef.current.delete(portfolio.id);
        });
    }
  }, [portfolios, resyncLinkedPortfolio, plan]);

  const planIsFree = plan?.isFree === true;
  const planSelectionReady = plan?.selectionReady === true;

  const freeBrokerageDemoteInFlightRef = useRef(false);
  const freeBrokerageDemoteNotifiedRef = useRef(false);

  // Free: snapshot brokerage portfolios as offline read-only and disconnect SnapTrade (per-connection cost).
  useEffect(() => {
    if (!planIsFree || !planSelectionReady || !workspaceHydrated) return;
    if (freeBrokerageDemoteInFlightRef.current) return;

    const liveAuthIds = new Set<string>();
    for (const p of portfolios) {
      if (!portfolioIsLiveBrokerage(p)) continue;
      const id = p.snaptrade?.authorizationId?.trim();
      if (id && id !== "offline") liveAuthIds.add(id);
    }
    if (liveAuthIds.size === 0) return;

    freeBrokerageDemoteInFlightRef.current = true;
    const offlineAt = new Date().toISOString();

    setPortfolios((prev) =>
      prev.map((p) => {
        if (!portfolioIsLiveBrokerage(p) || !p.snaptrade) return p;
        return {
          ...p,
          snaptrade: {
            ...p.snaptrade,
            // Drop live auth id after disconnect so we never hit SnapTrade with a dead link.
            authorizationId: "offline",
            offline: true,
            offlineAt,
          },
        };
      }),
    );

    void (async () => {
      await Promise.all(
        [...liveAuthIds].map(async (authorizationId) => {
          try {
            await fetch(`/api/snaptrade/connections/${encodeURIComponent(authorizationId)}`, {
              method: "DELETE",
            });
          } catch {
            /* best-effort disconnect */
          }
        }),
      );
      if (!freeBrokerageDemoteNotifiedRef.current) {
        freeBrokerageDemoteNotifiedRef.current = true;
        toast.message("Brokerage connection paused on Free.", {
          description: "Portfolios stay as offline copies. Upgrade to Pro to reconnect and sync.",
        });
      }
      freeBrokerageDemoteInFlightRef.current = false;
    })();
  }, [planIsFree, planSelectionReady, portfolios, workspaceHydrated]);

  const finalizeConnectBrokerage = useCallback(
    async ({ name, privacy, authorizationId, reconnectPortfolioId }: ConnectBrokerageCompletePayload) => {
      const t = name.trim();
      if (!t) return;

      // ── Reconnect path (incl. offline Free freeze re-linked on Pro): sync into the same portfolio. ──
      const reconnectTarget = reconnectPortfolioId
        ? portfolios.find((p) => p.id === reconnectPortfolioId)
        : undefined;
      if (reconnectTarget) {
        await resyncLinkedPortfolio(reconnectTarget.id, {
          updateFromYmd: null,
          authorizationIdOverride: authorizationId,
        });
        return;
      }

      const toastId = toast.loading("Syncing brokerage…");
      try {
        const res = await fetch("/api/snaptrade/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            authorizationId,
            syncSettings: DEFAULT_PORTFOLIO_SNAPTRADE_SYNC_SETTINGS,
          }),
        });
        const data = (await res.json()) as SnapTradeSyncApiResponse;
        if (!res.ok) {
          throw new Error(data.error ?? "Failed to sync brokerage.");
        }

        const portfolioId = newPortfolioId();

        setPortfolios((prev) => [
          ...prev,
          {
            id: portfolioId,
            name: t,
            privacy,
            snaptrade: {
              authorizationId: data.authorizationId ?? authorizationId,
              accountIds: Array.isArray(data.accountIds) ? data.accountIds : [],
              brokerageName: data.brokerageName ?? null,
              brokerageSlug: data.brokerageSlug ?? null,
              brokerageLogoUrl: data.brokerageLogoUrl ?? null,
              isRealTimeConnection: data.isRealTimeConnection === true,
              syncedAt: new Date().toISOString(),
              syncSettings: { ...DEFAULT_PORTFOLIO_SNAPTRADE_SYNC_SETTINGS },
            },
          },
        ]);

        const { quoted, transactions } = await applySnapTradeSyncToPortfolio(
          portfolioId,
          authorizationId,
          data,
        );
        setSelectedPortfolioId(portfolioId);

        toast.success(
          <span>
            Portfolio{" "}
            <a href="/portfolio" className="font-semibold underline underline-offset-2">
              &ldquo;{t}&rdquo;
            </a>{" "}
            connected
            {data.brokerageName ? ` to ${data.brokerageName}` : ""}.
          </span>,
          { id: toastId },
        );

        if (privacy === "public") {
          void putPublicPortfolioListingRequest({
            portfolioId,
            publish: true,
            displayName: t,
            metrics: metricsForPublicListing(quoted, transactions),
          }).then((r) => {
            if (r.ok) dispatchPublicListingsChanged();
          });
        }
      } catch (e) {
        const message = e instanceof Error ? e.message : "Failed to connect brokerage.";
        toast.error(message, { id: toastId });
        throw e;
      }
    },
    [
      applySnapTradeSyncToPortfolio,
      metricsForPublicListing,
      portfolios,
      resyncLinkedPortfolio,
      setSelectedPortfolioId,
    ],
  );

  const {
    portalActive: reconnectPortalActive,
    portalNode: reconnectPortalNode,
    startPortal: startReconnectPortal,
  } = useSnapTradeConnectPortal({
    onComplete: finalizeConnectBrokerage,
    onClose: () => {
      /* portal owns close; no modal shell for reconnect */
    },
  });

  const openReconnectBrokerage = useCallback(
    (portfolioId: string) => {
      if (plan && !plan.canConnectBrokerage) {
        toastProUpgrade({
          title: "Pro feature",
          description: "Brokerage reconnection is available on Pro only.",
          onUpgrade: openUpgradePlans,
        });
        return;
      }
      const p = portfolios.find((x) => x.id === portfolioId);
      if (!p?.snaptrade) return;
      void startReconnectPortal({
        name: p.name,
        privacy: p.privacy,
        reconnectPortfolioId: p.id,
      });
    },
    [openUpgradePlans, plan, portfolios, startReconnectPortal],
  );

  const openNewTransaction = useCallback(() => {
    const p = portfolios.find((x) => x.id === selectedPortfolioId);
    if (p?.kind === "combined") return;
    if (selectedPortfolioReadOnly) {
      if (p?.snaptrade) {
        if (plan?.canConnectBrokerage && selectedPortfolioId) {
          toast.error("Reconnect brokerage", {
            description: "Reconnect this brokerage to edit holdings and cash.",
          });
          openReconnectBrokerage(selectedPortfolioId);
        } else {
          toastProUpgrade({
            title: "Portfolio read-only",
            description:
              "This brokerage portfolio is read-only on Free. Upgrade to Pro to reconnect and edit.",
            onUpgrade: openUpgradePlans,
          });
        }
        return;
      }
      toast.error("Portfolio read-only", {
        description: "This portfolio is read-only.",
      });
      return;
    }
    setNewTransactionPreset(null);
    setNewTransactionOpen(true);
  }, [
    openReconnectBrokerage,
    openUpgradePlans,
    plan?.canConnectBrokerage,
    portfolios,
    selectedPortfolioId,
    selectedPortfolioReadOnly,
  ]);
  const openNewTransactionWithPreset = useCallback(
    (pick: CompanyPick) => {
      const p = portfolios.find((x) => x.id === selectedPortfolioId);
      if (p?.kind === "combined") return;
      if (selectedPortfolioReadOnly) {
        if (p?.snaptrade) {
          if (plan?.canConnectBrokerage && selectedPortfolioId) {
            toast.error("Reconnect brokerage", {
              description: "Reconnect this brokerage to edit holdings and cash.",
            });
            openReconnectBrokerage(selectedPortfolioId);
          } else {
            toastProUpgrade({
              title: "Portfolio read-only",
              description:
                "This brokerage portfolio is read-only on Free. Upgrade to Pro to reconnect and edit.",
              onUpgrade: openUpgradePlans,
            });
          }
          return;
        }
        toast.error("Portfolio read-only", {
        description: "This portfolio is read-only.",
      });
        return;
      }
      setNewTransactionPreset(pick);
      setNewTransactionOpen(true);
    },
    [
      openReconnectBrokerage,
      openUpgradePlans,
      plan?.canConnectBrokerage,
      portfolios,
      selectedPortfolioId,
      selectedPortfolioReadOnly,
    ],
  );
  const closeNewTransaction = useCallback(() => {
    setNewTransactionOpen(false);
    setNewTransactionPreset(null);
  }, []);
  const openAddCash = useCallback(() => {
    const p = portfolios.find((x) => x.id === selectedPortfolioId);
    if (p?.kind === "combined") return;
    if (selectedPortfolioReadOnly) {
      if (p?.snaptrade) {
        if (plan?.canConnectBrokerage && selectedPortfolioId) {
          toast.error("Reconnect brokerage", {
            description: "Reconnect this brokerage to edit holdings and cash.",
          });
          openReconnectBrokerage(selectedPortfolioId);
        } else {
          toastProUpgrade({
            title: "Portfolio read-only",
            description:
              "This brokerage portfolio is read-only on Free. Upgrade to Pro to reconnect and edit.",
            onUpgrade: openUpgradePlans,
          });
        }
        return;
      }
      toast.error("Portfolio read-only", {
        description: "This portfolio is read-only.",
      });
      return;
    }
    setAddCashModalOpen(true);
  }, [
    openReconnectBrokerage,
    openUpgradePlans,
    plan?.canConnectBrokerage,
    portfolios,
    selectedPortfolioId,
    selectedPortfolioReadOnly,
  ]);
  const closeAddCash = useCallback(() => setAddCashModalOpen(false), []);
  const openImportTransactions = useCallback(() => {
    const p = portfolios.find((x) => x.id === selectedPortfolioId);
    if (!p || p.kind === "combined") return;
    if (selectedPortfolioReadOnly) {
      if (p.snaptrade) {
        if (plan?.canConnectBrokerage && selectedPortfolioId) {
          toast.error("Reconnect brokerage", {
            description: "Reconnect this brokerage to edit holdings and cash.",
          });
          openReconnectBrokerage(selectedPortfolioId);
        } else {
          toastProUpgrade({
            title: "Portfolio read-only",
            description:
              "This brokerage portfolio is read-only on Free. Upgrade to Pro to reconnect and edit.",
            onUpgrade: openUpgradePlans,
          });
        }
        return;
      }
      toast.error("Portfolio read-only", {
        description: "This portfolio is read-only.",
      });
      return;
    }
    setImportTransactionsOpen(true);
  }, [
    openReconnectBrokerage,
    openUpgradePlans,
    plan?.canConnectBrokerage,
    portfolios,
    selectedPortfolioId,
    selectedPortfolioReadOnly,
  ]);
  const closeImportTransactions = useCallback(() => setImportTransactionsOpen(false), []);

  const updatePortfolioPrivacy = useCallback(
    (portfolioId: string, nextPrivacy: PortfolioPrivacy) => {
      const entry = portfolios.find((x) => x.id === portfolioId);
      if (!entry || entry.privacy === nextPrivacy) return;

      if (plan?.isFree && entry.snaptrade) {
        toastProUpgrade({
          title: "Portfolio offline",
          description: "This brokerage portfolio is offline on Free. Upgrade to manage it.",
          onUpgrade: openUpgradePlans,
        });
        return;
      }

      if (nextPrivacy === "public" && plan && !plan.canPublishPublicPortfolio) {
        toastProUpgrade({
          title: "Pro feature",
          description: "Public portfolios are available on Pro only.",
          onUpgrade: openUpgradePlans,
        });
        return;
      }

      setPortfolios((prev) =>
        prev.map((p) => (p.id === portfolioId ? { ...p, privacy: nextPrivacy } : p)),
      );

      const holdings = displayHoldingsByPortfolioId[portfolioId] ?? [];
      const txs = displayTransactionsByPortfolioId[portfolioId] ?? [];

      if (nextPrivacy === "public") {
        void putPublicPortfolioListingRequest({
          portfolioId,
          publish: true,
          displayName: entry.name,
          metrics: metricsForPublicListing(holdings, txs),
        }).then((r) => {
          if (r.ok) dispatchPublicListingsChanged();
        });
        toast.success("Portfolio is now public and appears on the Portfolios tab.");
      } else {
        void putPublicPortfolioListingRequest({ portfolioId, publish: false }).then((r) => {
          if (r.ok) dispatchPublicListingsChanged();
        });
        toast.success("Portfolio is now private.");
      }
    },
    [
      portfolios,
      displayHoldingsByPortfolioId,
      displayTransactionsByPortfolioId,
      metricsForPublicListing,
      plan,
      openUpgradePlans,
    ],
  );

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      if (createPortfolioOpen) {
        setCreatePortfolioOpen(false);
      } else if (connectBrokerageOpen) {
        setConnectBrokerageOpen(false);
      } else if (createCombinedOpen) {
        setCreateCombinedOpen(false);
      } else if (editPortfolioOpen) {
        setEditPortfolioOpen(false);
        setEditPortfolioId(null);
      } else if (snaptradeSyncPortfolioId) {
        closeSnaptradeSyncModal();
      } else if (addCashModalOpen) {
        setAddCashModalOpen(false);
      } else if (newTransactionOpen) {
        setNewTransactionOpen(false);
      } else if (editTransaction) {
        setEditTransaction(null);
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [addCashModalOpen, closeSnaptradeSyncModal, connectBrokerageOpen, createCombinedOpen, createPortfolioOpen, editPortfolioOpen, editTransaction, newTransactionOpen, snaptradeSyncPortfolioId]);

  useEffect(() => {
    if (!newTransactionOpen) {
      setEditPortfolioOpen(false);
      setCreatePortfolioOpen(false);
      setCreateCombinedOpen(false);
      setEditPortfolioId(null);
    }
  }, [newTransactionOpen]);

  const portfolioDisplayReady =
    (workspaceHydrated || portfolioBootstrapFromLocal) && holdingsMarkToMarketReady;
  const portfolioListReady = workspaceHydrated || portfolioBootstrapFromLocal;

  const setOverLimitCounts = plan?.setOverLimitCounts;
  const freePortfolioId = plan?.freeActivePortfolioId ?? null;
  const freePortfolioLocked = plan?.selection.free_portfolio_selection_locked === true;

  useEffect(() => {
    if (!setOverLimitCounts) return;
    const freeActiveId = plan?.freeActivePortfolioId ?? null;
    const freeActiveSlotOccupied =
      freeActiveId != null &&
      portfolios.some(
        (p) =>
          p.id === freeActiveId &&
          !portfolioIsDemo(p) &&
          !portfolioIsCombined(p) &&
          !p.snaptrade,
      );
    setOverLimitCounts({
      realPortfolios: countManualPortfoliosForFreeQuota(portfolios),
      brokeragePortfolios: countBrokeragePortfolios(portfolios),
      freeActiveSlotOccupied,
    });
  }, [portfolios, setOverLimitCounts, plan?.freeActivePortfolioId]);

  // When Free with one manual portfolio, snap free-active lock (manual only). Brokerage offline is viewable.
  useEffect(() => {
    if (!planIsFree || !planSelectionReady) return;
    const manuals = portfolios.filter(
      (p) => !portfolioIsDemo(p) && !portfolioIsCombined(p) && !p.snaptrade,
    );
    if (freePortfolioLocked && freePortfolioId) {
      const locked = portfolios.find((p) => p.id === freePortfolioId);
      // Ignore a stale lock on a brokerage book (Free slot is manual only).
      if (locked && !locked.snaptrade && !portfolioIsDemo(locked) && !portfolioIsCombined(locked)) {
        // Only snap from another manual/inaccessible pick — don't force off offline brokerage.
        const selected = portfolios.find((p) => p.id === selectedPortfolioId);
        if (
          selectedPortfolioId !== freePortfolioId &&
          selected &&
          !portfolioIsDemo(selected) &&
          !selected.snaptrade
        ) {
          setSelectedPortfolioState(freePortfolioId);
          saveLastSelectedPortfolioId(userId, freePortfolioId);
        }
        return;
      }
    }
    if (
      manuals.length === 1 &&
      selectedPortfolioId &&
      portfolioIsCombined(portfolios.find((p) => p.id === selectedPortfolioId) ?? null)
    ) {
      setSelectedPortfolioState(manuals[0]!.id);
    }
  }, [
    planIsFree,
    planSelectionReady,
    freePortfolioLocked,
    freePortfolioId,
    portfolios,
    selectedPortfolioId,
    userId,
  ]);

  // Unpublish public portfolios when Free plan (after workspace list is trustworthy).
  const unpublishOnFreeRef = useRef(false);
  useEffect(() => {
    if (!planIsFree || !planSelectionReady || !portfolioListReady || unpublishOnFreeRef.current) {
      return;
    }
    const publics = portfolios.filter((p) => p.privacy === "public" && !portfolioIsDemo(p));
    if (publics.length === 0) return;
    unpublishOnFreeRef.current = true;
    setPortfolios((prev) =>
      prev.map((p) => (p.privacy === "public" ? { ...p, privacy: "private" as const } : p)),
    );
    for (const p of publics) {
      void putPublicPortfolioListingRequest({ portfolioId: p.id, publish: false });
    }
    toast.message("Public portfolios were set private on Free.", {
      description: "Upgrade to Pro to publish again.",
    });
  }, [planIsFree, planSelectionReady, portfolioListReady, portfolios]);

  const value = useMemo(
    () => ({
      portfolios,
      selectedPortfolioId,
      setSelectedPortfolioId,
      isFreePortfolioAccessible,
      holdingsByPortfolioId: displayHoldingsByPortfolioId,
      addHolding,
      transactionsByPortfolioId: displayTransactionsByPortfolioId,
      addTransaction,
      openEditPortfolio,
      openCreatePortfolio,
      openCreateCombinedPortfolio,
      openConnectBrokerage,
      openReconnectBrokerage,
      openTryDemoPortfolio,
      openSnaptradeSyncModal,
      resyncLinkedPortfolio,
      updatePortfolioPrivacy,
      selectedPortfolioReadOnly,
      newTransactionOpen,
      openNewTransaction,
      openNewTransactionWithPreset,
      closeNewTransaction,
      addCashModalOpen,
      openAddCash,
      closeAddCash,
      openImportTransactions,
      editTransaction,
      openEditTransaction,
      closeEditTransaction,
      setPortfolioTransactions,
      setPortfolioHoldings,
      removePortfolioTransaction,
      removePortfolioTransactions,
      restorePortfolioTransaction,
      portfolioDisplayReady,
      portfolioListReady,
    }),
    [
      portfolios,
      selectedPortfolioId,
      displayHoldingsByPortfolioId,
      addHolding,
      displayTransactionsByPortfolioId,
      addTransaction,
      setPortfolioTransactions,
      setPortfolioHoldings,
      removePortfolioTransaction,
      removePortfolioTransactions,
      restorePortfolioTransaction,
      openEditPortfolio,
      openCreatePortfolio,
      openCreateCombinedPortfolio,
      openConnectBrokerage,
      openReconnectBrokerage,
      openTryDemoPortfolio,
      openSnaptradeSyncModal,
      resyncLinkedPortfolio,
      updatePortfolioPrivacy,
      selectedPortfolioReadOnly,
      newTransactionOpen,
      openNewTransaction,
      openNewTransactionWithPreset,
      closeNewTransaction,
      addCashModalOpen,
      openAddCash,
      closeAddCash,
      openImportTransactions,
      editTransaction,
      openEditTransaction,
      closeEditTransaction,
      portfolioDisplayReady,
      portfolioListReady,
      setSelectedPortfolioId,
      isFreePortfolioAccessible,
    ],
  );

  return (
    <PortfolioWorkspaceContext.Provider value={value}>
      {children}
      <FreePortfolioPickModal
        open={freePortfolioPickOpen}
        portfolios={portfolios}
        onClose={() => setFreePortfolioPickOpen(false)}
      />
      {newTransactionOpen ? (
        <NewTransactionModal
          open
          presetCompany={newTransactionPreset}
          onClose={closeNewTransaction}
        />
      ) : null}
      <AddCashModal open={addCashModalOpen} onClose={closeAddCash} />
      {importTransactionsOpen ? (
        <ImportTransactionsModal open onClose={closeImportTransactions} />
      ) : null}
      {editTransaction != null ? (
        <EditTransactionModal open transaction={editTransaction} onClose={closeEditTransaction} />
      ) : null}
      {snaptradeSyncPortfolioId ?
        (() => {
          const syncPortfolio = portfolios.find((p) => p.id === snaptradeSyncPortfolioId);
          if (!syncPortfolio?.snaptrade) return null;
          return (
            <PortfolioSnaptradeSyncModal
              open
              portfolioName={syncPortfolio.name}
              transactions={displayTransactionsByPortfolioId[snaptradeSyncPortfolioId] ?? []}
              updating={snaptradeSyncUpdating}
              onClose={closeSnaptradeSyncModal}
              onUpdate={(updateFromYmd) => {
                const id = snaptradeSyncPortfolioId;
                if (!id) return;
                setSnaptradeSyncUpdating(true);
                void resyncLinkedPortfolio(id, { updateFromYmd })
                  .then(() => setSnaptradeSyncPortfolioId(null))
                  .catch(() => {
                    /* toast handled in resync */
                  })
                  .finally(() => setSnaptradeSyncUpdating(false));
              }}
            />
          );
        })()
      : null}
      {editPortfolioOpen && editPortfolioId ? (
        <EditPortfolioModal
          key={editPortfolioId}
          initialName={portfolios.find((p) => p.id === editPortfolioId)?.name ?? ""}
          initialPrivacy={portfolios.find((p) => p.id === editPortfolioId)?.privacy ?? "private"}
          isCombined={portfolios.find((p) => p.id === editPortfolioId)?.kind === "combined"}
          isDemo={portfolioIsDemo(portfolios.find((p) => p.id === editPortfolioId))}
          allPortfolios={portfolios}
          initialCombinedFromIds={portfolios.find((p) => p.id === editPortfolioId)?.combinedFrom}
          snaptradeLink={portfolios.find((p) => p.id === editPortfolioId)?.snaptrade ?? null}
          privacyDisabled={
            (displayTransactionsByPortfolioId[editPortfolioId] ?? []).length === 0
          }
          privacyDisabledValues={
            plan && !plan.canPublishPublicPortfolio ? (["public"] as const) : undefined
          }
          onClose={() => {
            setEditPortfolioOpen(false);
            setEditPortfolioId(null);
          }}
          onSave={(name, nextPrivacy, combinedSourceIds) => {
            const t = name.trim();
            const id = editPortfolioId;
            const editing = portfolios.find((p) => p.id === id);
            if (editing?.kind === "combined") {
              if (t.length === 0) return;
              const rawIds = combinedSourceIds ?? [];
              const filteredSourceIds = rawIds.filter((sid) =>
                portfolios.some((x) => x.id === sid && x.kind !== "combined"),
              );
              if (filteredSourceIds.length < 2) return;

              setPortfolios((prev) =>
                prev.map((p) =>
                  p.id === id ?
                    { ...p, name: t, privacy: nextPrivacy, combinedFrom: filteredSourceIds }
                  : p,
                ),
              );

              const listsH = filteredSourceIds.map((sid) => holdingsByPortfolioId[sid] ?? []);
              const mergedH = mergeHoldingsBySymbol(listsH);
              const listsT = filteredSourceIds.map((sid) => transactionsByPortfolioId[sid] ?? []);
              const mergedT = mergeTransactionsSorted(listsT);

              if (nextPrivacy === "public") {
                void putPublicPortfolioListingRequest({
                  portfolioId: id,
                  publish: true,
                  displayName: t,
                  metrics: metricsForPublicListing(mergedH, mergedT),
                }).then((r) => {
                  if (r.ok) dispatchPublicListingsChanged();
                });
              } else {
                void putPublicPortfolioListingRequest({ portfolioId: id, publish: false }).then((r) => {
                  if (r.ok) dispatchPublicListingsChanged();
                });
              }

              toast.success(`Combined portfolio "${t}" updated.`);
              setEditPortfolioOpen(false);
              setEditPortfolioId(null);
              return;
            }

            const holdings = id ? holdingsByPortfolioId[id] ?? [] : [];
            const txs = id ? transactionsByPortfolioId[id] ?? [] : [];

            setPortfolios((prev) => {
              if (!id) return prev;
              if (t.length === 0) {
                const next = ensureAtLeastOnePortfolio(prev.filter((p) => p.id !== id));
                setSelectedPortfolioId((sel) => (sel !== id ? sel : next[0]!.id));
                setHoldingsByPortfolioId((h) => {
                  const copy = { ...h };
                  delete copy[id];
                  return copy;
                });
                setTransactionsByPortfolioId((h) => {
                  const copy = { ...h };
                  delete copy[id];
                  return copy;
                });
                return next;
              }
              return prev.map((p) => (p.id === id ? { ...p, name: t, privacy: nextPrivacy } : p));
            });

            if (id && t.length > 0) {
              if (nextPrivacy === "public") {
                void putPublicPortfolioListingRequest({
                  portfolioId: id,
                  publish: true,
                  displayName: t,
                  metrics: metricsForPublicListing(holdings, txs),
                }).then((r) => {
                  if (r.ok) dispatchPublicListingsChanged();
                });
              } else {
                void putPublicPortfolioListingRequest({ portfolioId: id, publish: false }).then((r) => {
                  if (r.ok) dispatchPublicListingsChanged();
                });
              }
            } else if (id && t.length === 0) {
              void putPublicPortfolioListingRequest({ portfolioId: id, publish: false }).then((r) => {
                if (r.ok) dispatchPublicListingsChanged();
              });
            }

            if (t.length > 0) {
              toast.success(`Portfolio "${t}" updated.`);
            }

            setEditPortfolioOpen(false);
            setEditPortfolioId(null);
          }}
          onRequestDelete={() => {
            const id = editPortfolioId;
            if (!id) return;
            setDeletePortfolioConfirmId(id);
            setEditPortfolioOpen(false);
            setEditPortfolioId(null);
          }}
        />
      ) : null}
      <DeletePortfolioConfirmModal
        portfolioId={deletePortfolioConfirmId}
        portfolioName={
          deletePortfolioConfirmId ?
            portfolios.find((p) => p.id === deletePortfolioConfirmId)?.name ?? "this portfolio"
          : ""
        }
        onClose={() => setDeletePortfolioConfirmId(null)}
        onConfirmDelete={() => {
          const id = deletePortfolioConfirmId;
          if (!id) return;
          const deleted = portfolios.find((p) => p.id === id);
          if (deleted && deleted.privacy === "public") {
            void putPublicPortfolioListingRequest({ portfolioId: id, publish: false }).then((r) => {
              if (r.ok) dispatchPublicListingsChanged();
            });
          }
          setPortfolios((prev) => {
            const without = prev.filter((p) => p.id !== id);
            const pruned = without
              .map((p) => {
                if (p.kind !== "combined" || !p.combinedFrom) return p;
                const nextFrom = p.combinedFrom.filter((x) => x !== id);
                if (nextFrom.length < 2) return null;
                return { ...p, combinedFrom: nextFrom };
              })
              .filter((p): p is PortfolioEntry => p != null);
            const next = ensureAtLeastOnePortfolio(pruned);
            setSelectedPortfolioId((sel) => (sel !== id ? sel : next[0]!.id));
            setHoldingsByPortfolioId((h) => {
              const copy = { ...h };
              delete copy[id];
              return copy;
            });
            setTransactionsByPortfolioId((h) => {
              const copy = { ...h };
              delete copy[id];
              return copy;
            });
            return next;
          });
          if (deleted) {
            toast.success(`Portfolio "${deleted.name}" deleted.`);
          } else {
            toast.success("Portfolio deleted.");
          }
          setDeletePortfolioConfirmId(null);
        }}
      />
      {createPortfolioOpen ? (
        <CreatePortfolioModal
          key={createPortfolioMode}
          initialMode={createPortfolioMode}
          onClose={() => setCreatePortfolioOpen(false)}
          onConnectBrokerageComplete={async (payload) => {
            await finalizeConnectBrokerage(payload);
            setCreatePortfolioOpen(false);
          }}
          onAdd={(name, nextPrivacy) => {
            const t = name.trim();
            if (t.length === 0) return;
            const id = newPortfolioId();
            const freeActiveId = plan?.freeActivePortfolioId ?? null;
            const freeSlotMissing =
              plan?.isFree === true &&
              (freeActiveId == null ||
                !portfolios.some(
                  (p) =>
                    p.id === freeActiveId &&
                    !portfolioIsDemo(p) &&
                    !portfolioIsCombined(p) &&
                    !p.snaptrade,
                ));
            setPortfolios((prev) => [...prev, { id, name: t, privacy: nextPrivacy }]);
            // Bypass Free lock gate — this book becomes the Free active slot when needed.
            setSelectedPortfolioState(id);
            saveLastSelectedPortfolioId(userId, id);
            setCreatePortfolioOpen(false);
            toast.success(
              <span>
                Portfolio{" "}
                <a
                  href="/portfolio"
                  className="font-semibold underline underline-offset-2"
                >
                  &ldquo;{t}&rdquo;
                </a>{" "}
                created.
              </span>,
            );
            if (freeSlotMissing && plan) {
              void plan.selectFreePortfolio(id).then((ok) => {
                if (!ok) {
                  toast.error("Could not activate this portfolio on Free. Try again.");
                }
              });
            }
            if (nextPrivacy === "public") {
              void putPublicPortfolioListingRequest({
                portfolioId: id,
                publish: true,
                displayName: t,
                metrics: metricsForPublicListing([], []),
              }).then((r) => {
                if (r.ok) dispatchPublicListingsChanged();
              });
            }
          }}
        />
      ) : null}
      {createCombinedOpen ? (
        <CreateCombinedPortfolioModal
          portfolios={portfolios}
          onClose={() => setCreateCombinedOpen(false)}
          onAdd={(name, sourceIds) => {
            const t = name.trim();
            if (t.length === 0 || sourceIds.length < 2) return;
            const id = newPortfolioId();
            setPortfolios((prev) => [
              ...prev,
              {
                id,
                name: t,
                privacy: "private",
                kind: "combined",
                combinedFrom: [...sourceIds],
              },
            ]);
            setSelectedPortfolioId(id);
            setCreateCombinedOpen(false);
            toast.success(`Combined portfolio "${t}" created.`, {
              description: `Merges ${sourceIds.length} portfolios`,
            });
          }}
        />
      ) : null}
      <ConnectBrokerageFlow
        open={connectBrokerageOpen}
        onClose={() => setConnectBrokerageOpen(false)}
        onComplete={finalizeConnectBrokerage}
      />
      {reconnectPortalActive ? reconnectPortalNode : null}
    </PortfolioWorkspaceContext.Provider>
  );
}

export { usePortfolioWorkspace } from "@/components/portfolio/portfolio-workspace-context";
