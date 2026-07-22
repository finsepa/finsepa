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
import { usePathname } from "next/navigation";
import { SpinnerLabel } from "@/components/ui/spinner";
import { toast } from "sonner";

import { SegmentedControl } from "@/components/design-system/segmented-control";
import { AddCashModal } from "@/components/layout/add-cash-modal";
import { ImportTransactionsModal } from "@/components/portfolio/import-transactions-modal";
import { DeletePortfolioConfirmModal } from "@/components/portfolio/delete-portfolio-confirm-modal";
import { EditTransactionModal } from "@/components/layout/edit-transaction-modal";
import { NewTransactionModal } from "@/components/layout/new-transaction-modal";
import { ClearableInput } from "@/components/layout/clearable-input";
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
        <span className="text-sm font-medium leading-5 text-[#0F0F0F]">{label}</span>
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
  allPortfolios,
  initialCombinedFromIds,
  snaptradeLink,
  onClose,
  onSave,
  onRequestDelete,
}: {
  initialName: string;
  initialPrivacy: PortfolioPrivacy;
  isCombined?: boolean;
  allPortfolios: PortfolioEntry[];
  initialCombinedFromIds?: string[];
  snaptradeLink?: PortfolioSnaptradeLink | null;
  onClose: () => void;
  onSave: (name: string, privacy: PortfolioPrivacy, combinedSourceIds?: string[]) => void;
  /** Opens delete confirmation; does not delete immediately. */
  onRequestDelete: () => void;
}) {
  const titleId = useId();
  const [name, setName] = useState(initialName);
  const [privacy, setPrivacy] = useState<PortfolioPrivacy>(initialPrivacy);

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
    setPrivacy(initialPrivacy);
  }, [initialPrivacy]);

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
              className="inline-flex min-h-9 shrink-0 items-center justify-center rounded-[10px] px-4 py-2 text-sm font-medium text-[#DC2626] transition-colors hover:bg-[#FEE2E2] hover:text-[#B91C1C]"
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
        <ModalField label={<PortfolioPrivacyFieldLabel />}>
          <PortfolioPrivacySelect value={privacy} onChange={setPrivacy} />
        </ModalField>
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
}: {
  onClose: () => void;
  onAdd: (name: string, privacy: PortfolioPrivacy) => void;
  onConnectBrokerageComplete: (payload: ConnectBrokerageCompletePayload) => void | Promise<void>;
}) {
  const titleId = useId();
  const [mode, setMode] = useState<CreatePortfolioMode>("manual");
  const [name, setName] = useState("");
  const [privacy, setPrivacy] = useState<PortfolioPrivacy>("private");

  const { portalLoading, portalActive, portalNode, reset, startPortal } = useSnapTradeConnectPortal({
    onComplete: onConnectBrokerageComplete,
    onClose,
  });

  const closeAll = useCallback(() => {
    reset();
    setMode("manual");
    setName("");
    setPrivacy("private");
    onClose();
  }, [onClose, reset]);

  const canSubmit = name.trim().length > 0 && !portalLoading;
  const isBrokerage = mode === "brokerage";

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
          value={mode}
          onChange={setMode}
          options={[
            { value: "manual", label: "Manual Portfolio" },
            { value: "brokerage", label: "Connect brokerage" },
          ]}
        />
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
          <PortfolioPrivacySelect value={privacy} onChange={setPrivacy} />
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

  const setSelectedPortfolioId = useCallback<Dispatch<SetStateAction<string | null>>>(
    (action) => {
      setSelectedPortfolioState((prev) => {
        const next = typeof action === "function" ? (action as (p: string | null) => string | null)(prev) : action;
        if (next !== prev) saveLastSelectedPortfolioId(userId, next);
        return next;
      });
    },
    [userId],
  );

  const [editPortfolioOpen, setEditPortfolioOpen] = useState(false);
  const [editPortfolioId, setEditPortfolioId] = useState<string | null>(null);
  const [deletePortfolioConfirmId, setDeletePortfolioConfirmId] = useState<string | null>(null);
  const [createPortfolioOpen, setCreatePortfolioOpen] = useState(false);
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
    return portfolioIsCombined(p ?? null);
  }, [portfolios, selectedPortfolioId]);

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
                if (!putRes.ok) {
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
            } else if (local && portfolioStateHasLedgerData(local)) {
              applyWorkspaceState(local);
              const putRes = await fetch("/api/portfolio/workspace", {
                method: "PUT",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ state: local }),
              });
              if (!putRes.ok) {
                toast.error("Portfolio not synced", {
                  description: "Saved on this device — we could not update your account yet.",
                });
              }
            } else if (local) {
              applyWorkspaceState(local);
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
    if (appliedLedgerFingerprintRef.current === null) return;
    const snapshot: PersistedPortfolioState = {
      v: 1,
      savedAt: Date.now(),
      portfolios,
      selectedPortfolioId,
      holdingsByPortfolioId,
      transactionsByPortfolioId,
    };
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
    if (appliedLedgerFingerprintRef.current === null) return;
    const id = window.setTimeout(() => {
      const snapshot: PersistedPortfolioState = {
        v: 1,
        savedAt: Date.now(),
        portfolios,
        selectedPortfolioId,
        holdingsByPortfolioId,
        transactionsByPortfolioId,
      };
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
        if (!res.ok) {
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

  const openEditTransaction = useCallback(
    (t: PortfolioTransaction) => {
      const p = portfolios.find((x) => x.id === selectedPortfolioId);
      if (p?.kind === "combined") return;
      if (isSnaptradeBrokerRow(t)) {
        toast.error("This is a brokerage transaction", {
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
        toast.error("Brokerage transactions can't be deleted", {
          description: "Rows imported from your broker are managed by sync. Disconnect the brokerage to remove them.",
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

  const openEditPortfolio = useCallback((id: string) => {
    setCreatePortfolioOpen(false);
    setCreateCombinedOpen(false);
    setEditPortfolioId(id);
    setEditPortfolioOpen(true);
  }, []);

  const openCreatePortfolio = useCallback(() => {
    setEditPortfolioOpen(false);
    setEditPortfolioId(null);
    setCreateCombinedOpen(false);
    setCreatePortfolioOpen(true);
  }, []);

  const openCreateCombinedPortfolio = useCallback(() => {
    setEditPortfolioOpen(false);
    setEditPortfolioId(null);
    setCreatePortfolioOpen(false);
    setConnectBrokerageOpen(false);
    setCreateCombinedOpen(true);
  }, []);

  const openConnectBrokerage = useCallback(() => {
    setEditPortfolioOpen(false);
    setEditPortfolioId(null);
    setCreatePortfolioOpen(false);
    setCreateCombinedOpen(false);
    setConnectBrokerageOpen(true);
  }, []);

  const openSnaptradeSyncModal = useCallback((portfolioId: string) => {
    setSnaptradeSyncPortfolioId(portfolioId);
  }, []);

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
      options?: { silent?: boolean; updateFromYmd?: string | null },
    ) => {
      const portfolio = portfolios.find((p) => p.id === portfolioId);
      const authorizationId = portfolio?.snaptrade?.authorizationId;
      if (!portfolio || !authorizationId) return;

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
    [applySnapTradeSyncToPortfolio, metricsForPublicListing, portfolios, transactionsByPortfolioId],
  );

  const autoSyncInFlightRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const MS_DAY = 24 * 60 * 60 * 1000;
    const now = Date.now();

    for (const portfolio of portfolios) {
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
  }, [portfolios, resyncLinkedPortfolio]);

  const finalizeConnectBrokerage = useCallback(
    async ({ name, privacy, authorizationId, reconnectPortfolioId }: ConnectBrokerageCompletePayload) => {
      const t = name.trim();
      if (!t) return;

      // ── Reconnect path: update the existing linked portfolio in place (no duplicate). ──
      const reconnectTarget = reconnectPortfolioId
        ? portfolios.find((p) => p.id === reconnectPortfolioId)
        : undefined;
      if (reconnectTarget) {
        await resyncLinkedPortfolio(reconnectTarget.id, { updateFromYmd: null });
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
        const message = e instanceof Error ? e.message : "Failed to sync brokerage.";
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

  const openNewTransaction = useCallback(() => {
    const p = portfolios.find((x) => x.id === selectedPortfolioId);
    if (p?.kind === "combined") return;
    setNewTransactionPreset(null);
    setNewTransactionOpen(true);
  }, [portfolios, selectedPortfolioId]);
  const openNewTransactionWithPreset = useCallback(
    (pick: CompanyPick) => {
      const p = portfolios.find((x) => x.id === selectedPortfolioId);
      if (p?.kind === "combined") return;
      setNewTransactionPreset(pick);
      setNewTransactionOpen(true);
    },
    [portfolios, selectedPortfolioId],
  );
  const closeNewTransaction = useCallback(() => {
    setNewTransactionOpen(false);
    setNewTransactionPreset(null);
  }, []);
  const openAddCash = useCallback(() => {
    const p = portfolios.find((x) => x.id === selectedPortfolioId);
    if (p?.kind === "combined") return;
    setAddCashModalOpen(true);
  }, [portfolios, selectedPortfolioId]);
  const closeAddCash = useCallback(() => setAddCashModalOpen(false), []);
  const openImportTransactions = useCallback(() => {
    const p = portfolios.find((x) => x.id === selectedPortfolioId);
    if (!p || p.kind === "combined") return;
    setImportTransactionsOpen(true);
  }, [portfolios, selectedPortfolioId]);
  const closeImportTransactions = useCallback(() => setImportTransactionsOpen(false), []);

  const updatePortfolioPrivacy = useCallback(
    (portfolioId: string, nextPrivacy: PortfolioPrivacy) => {
      const entry = portfolios.find((x) => x.id === portfolioId);
      if (!entry || entry.privacy === nextPrivacy) return;

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

  const value = useMemo(
    () => ({
      portfolios,
      selectedPortfolioId,
      setSelectedPortfolioId,
      holdingsByPortfolioId: displayHoldingsByPortfolioId,
      addHolding,
      transactionsByPortfolioId: displayTransactionsByPortfolioId,
      addTransaction,
      openEditPortfolio,
      openCreatePortfolio,
      openCreateCombinedPortfolio,
      openConnectBrokerage,
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
      setSelectedPortfolioId,
    ],
  );

  return (
    <PortfolioWorkspaceContext.Provider value={value}>
      {children}
      <NewTransactionModal
        open={newTransactionOpen}
        presetCompany={newTransactionPreset}
        onClose={closeNewTransaction}
      />
      <AddCashModal open={addCashModalOpen} onClose={closeAddCash} />
      <ImportTransactionsModal open={importTransactionsOpen} onClose={closeImportTransactions} />
      <EditTransactionModal
        open={editTransaction != null}
        transaction={editTransaction}
        onClose={closeEditTransaction}
      />
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
          allPortfolios={portfolios}
          initialCombinedFromIds={portfolios.find((p) => p.id === editPortfolioId)?.combinedFrom}
          snaptradeLink={portfolios.find((p) => p.id === editPortfolioId)?.snaptrade ?? null}
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
          onClose={() => setCreatePortfolioOpen(false)}
          onConnectBrokerageComplete={async (payload) => {
            await finalizeConnectBrokerage(payload);
            setCreatePortfolioOpen(false);
          }}
          onAdd={(name, nextPrivacy) => {
            const t = name.trim();
            if (t.length === 0) return;
            const id = newPortfolioId();
            setPortfolios((prev) => [...prev, { id, name: t, privacy: nextPrivacy }]);
            setSelectedPortfolioId(id);
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
    </PortfolioWorkspaceContext.Provider>
  );
}

export { usePortfolioWorkspace } from "@/components/portfolio/portfolio-workspace-context";
