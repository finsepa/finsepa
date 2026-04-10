"use client";

import type { ReactNode } from "react";
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
import { X } from "lucide-react";

import { AddCashModal } from "@/components/layout/add-cash-modal";
import { DeletePortfolioConfirmModal } from "@/components/portfolio/delete-portfolio-confirm-modal";
import { EditTransactionModal } from "@/components/layout/edit-transaction-modal";
import { NewTransactionModal } from "@/components/layout/new-transaction-modal";
import { ClearableInput } from "@/components/layout/clearable-input";
import { CreateCombinedPortfolioModal } from "@/components/portfolio/create-combined-portfolio-modal";
import { PortfolioWorkspaceContext } from "@/components/portfolio/portfolio-workspace-context";
import { cn } from "@/lib/utils";
import { PortfolioPrivacySelect } from "@/components/portfolio/portfolio-privacy-select";
import {
  newPortfolioId,
  portfolioIsCombined,
  type PortfolioEntry,
  type PortfolioHolding,
  type PortfolioPrivacy,
  type PortfolioTransaction,
} from "@/components/portfolio/portfolio-types";
import { mergeHoldingsBySymbol, mergeTransactionsSorted } from "@/lib/portfolio/merge-combined-portfolio";
import {
  loadPersistedPortfolioStateForUser,
  parsePersistedPortfolioUnknown,
  savePersistedPortfolioStateForUser,
  type PersistedPortfolioState,
} from "@/lib/portfolio/portfolio-storage";
import { computePublicPortfolioListingMetrics } from "@/lib/portfolio/public-listing-metrics";
import {
  refreshHoldingMarketPrices,
  replayTradeTransactionsToHoldings,
} from "@/lib/portfolio/rebuild-holdings-from-trades";

/** Always keep at least one portfolio; created when the user deletes the last one. */
const DEFAULT_PORTFOLIO_NAME = "My Portfolio";

function ensureAtLeastOnePortfolio(portfolios: PortfolioEntry[]): PortfolioEntry[] {
  if (portfolios.length > 0) return portfolios;
  return [{ id: newPortfolioId(), name: DEFAULT_PORTFOLIO_NAME, privacy: "private" }];
}

function ModalField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex w-full flex-col gap-2">
      <span className="text-sm font-medium leading-5 text-[#09090B]">{label}</span>
      {children}
    </div>
  );
}

function PublicPrivacyNotice() {
  return (
    <p
      role="status"
      className="w-full rounded-[10px] border border-[#BFDBFE] bg-[#EFF6FF] px-4 py-3 text-sm leading-5 text-[#1E3A8A]"
    >
      You selected your portfolio to be shared publicly. Everyone in the community will see your portfolio on
      the Portfolios tab once you click Save or Add.
    </p>
  );
}

function EditPortfolioModal({
  initialName,
  initialPrivacy,
  isCombined = false,
  combinedFromSummary = "",
  onClose,
  onSave,
  onRequestDelete,
}: {
  initialName: string;
  initialPrivacy: PortfolioPrivacy;
  /** Read-only aggregate portfolio — name only; privacy/sources are fixed. */
  isCombined?: boolean;
  combinedFromSummary?: string;
  onClose: () => void;
  onSave: (name: string, privacy: PortfolioPrivacy) => void;
  /** Opens delete confirmation; does not delete immediately. */
  onRequestDelete: () => void;
}) {
  const titleId = useId();
  const [name, setName] = useState(initialName);
  const [privacy, setPrivacy] = useState<PortfolioPrivacy>(initialPrivacy);

  useEffect(() => {
    setName(initialName);
  }, [initialName]);

  useEffect(() => {
    setPrivacy(initialPrivacy);
  }, [initialPrivacy]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center bg-black/40 p-4"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="flex w-full max-w-[480px] flex-col rounded-xl bg-white shadow-[0px_10px_16px_-3px_rgba(10,10,10,0.1),0px_4px_6px_0px_rgba(10,10,10,0.04)]"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-[#E4E4E7] px-5 py-3">
          <h2 id={titleId} className="text-lg font-semibold leading-7 tracking-tight text-[#09090B]">
            {isCombined ? "Edit combined portfolio" : "Edit portfolio"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] text-[#09090B] transition-colors hover:bg-[#F4F4F5]"
            aria-label="Close"
          >
            <X className="h-5 w-5" strokeWidth={2} />
          </button>
        </div>

        <div className="flex flex-col gap-4 px-5 pb-5 pt-5">
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
            <ModalField label="Source portfolios">
              <p className="rounded-[10px] border border-[#E4E4E7] bg-[#F4F4F5] px-4 py-3 text-sm leading-5 text-[#71717A]">
                {combinedFromSummary || "—"}
              </p>
              <p className="text-xs leading-4 text-[#71717A]">
                To change which portfolios are included, create a new combined portfolio. Transactions and cash
                stay in each source portfolio.
              </p>
            </ModalField>
          ) : (
            <ModalField label="Privacy">
              <div className="flex w-full flex-col gap-2">
                <PortfolioPrivacySelect value={privacy} onChange={setPrivacy} />
                {privacy === "public" ? <PublicPrivacyNotice /> : null}
              </div>
            </ModalField>
          )}
        </div>

        <div className="flex shrink-0 gap-3 border-t border-[#E4E4E7] px-6 py-4">
          <button
            type="button"
            onClick={onRequestDelete}
            className="flex min-h-9 flex-1 items-center justify-center rounded-[10px] bg-[#F4F4F5] px-4 py-2 text-sm font-medium text-[#09090B] transition-colors hover:bg-[#EBEBEB]"
          >
            Delete
          </button>
          <button
            type="button"
            onClick={() => onSave(name, isCombined ? initialPrivacy : privacy)}
            className="flex min-h-9 flex-1 items-center justify-center rounded-[10px] bg-[#09090B] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#27272A]"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

function CreatePortfolioModal({
  onClose,
  onAdd,
}: {
  onClose: () => void;
  onAdd: (name: string, privacy: PortfolioPrivacy) => void;
}) {
  const titleId = useId();
  const [name, setName] = useState("");
  const [privacy, setPrivacy] = useState<PortfolioPrivacy>("private");
  const canAdd = name.trim().length > 0;

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center bg-black/40 p-4"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="flex w-full max-w-[480px] flex-col rounded-xl bg-white shadow-[0px_10px_16px_-3px_rgba(10,10,10,0.1),0px_4px_6px_0px_rgba(10,10,10,0.04)]"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-[#E4E4E7] px-5 py-3">
          <h2 id={titleId} className="text-lg font-semibold leading-7 tracking-tight text-[#09090B]">
            Create new portfolio
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] text-[#09090B] transition-colors hover:bg-[#F4F4F5]"
            aria-label="Close"
          >
            <X className="h-5 w-5" strokeWidth={2} />
          </button>
        </div>

        <div className="flex flex-col gap-4 px-5 pb-5 pt-5">
          <ModalField label="Name">
            <ClearableInput
              type="text"
              value={name}
              onChange={setName}
              placeholder="Enter name"
              clearLabel="Clear name"
            />
          </ModalField>
          <ModalField label="Privacy">
            <div className="flex w-full flex-col gap-2">
              <PortfolioPrivacySelect value={privacy} onChange={setPrivacy} />
              {privacy === "public" ? <PublicPrivacyNotice /> : null}
            </div>
          </ModalField>
        </div>

        <div className="flex shrink-0 gap-3 border-t border-[#E4E4E7] px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="flex min-h-9 flex-1 items-center justify-center rounded-[10px] bg-[#F4F4F5] px-4 py-2 text-sm font-medium text-[#09090B] transition-colors hover:bg-[#EBEBEB]"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!canAdd}
            onClick={() => onAdd(name, privacy)}
            className={cn(
              "flex min-h-9 flex-1 items-center justify-center rounded-[10px] px-4 py-2 text-sm font-medium text-white transition-colors",
              canAdd
                ? "bg-[#09090B] hover:bg-[#27272A]"
                : "cursor-not-allowed bg-[#A1A1AA] opacity-50",
            )}
          >
            Add
          </button>
        </div>
      </div>
    </div>
  );
}

export function PortfolioWorkspaceProvider({
  children,
  userId,
}: {
  children: ReactNode;
  userId: string;
}) {
  const portfolioSeed = useMemo(() => {
    const id = newPortfolioId();
    return {
      list: [{ id, name: DEFAULT_PORTFOLIO_NAME, privacy: "private" as const }],
      selectedId: id,
    };
  }, []);

  const [portfolios, setPortfolios] = useState<PortfolioEntry[]>(portfolioSeed.list);
  const [selectedPortfolioId, setSelectedPortfolioId] = useState<string | null>(portfolioSeed.selectedId);

  const [editPortfolioOpen, setEditPortfolioOpen] = useState(false);
  const [editPortfolioId, setEditPortfolioId] = useState<string | null>(null);
  const [deletePortfolioConfirmId, setDeletePortfolioConfirmId] = useState<string | null>(null);
  const [createPortfolioOpen, setCreatePortfolioOpen] = useState(false);
  const [createCombinedOpen, setCreateCombinedOpen] = useState(false);
  const [newTransactionOpen, setNewTransactionOpen] = useState(false);
  const [addCashModalOpen, setAddCashModalOpen] = useState(false);
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

  const applyWorkspaceState = useCallback((saved: PersistedPortfolioState) => {
    setPortfolios(saved.portfolios);
    setSelectedPortfolioId(saved.selectedPortfolioId);
    setHoldingsByPortfolioId(saved.holdingsByPortfolioId);
    setTransactionsByPortfolioId(saved.transactionsByPortfolioId);
  }, []);

  /** Instant balance from device cache; server merge still runs in the effect below. */
  useLayoutEffect(() => {
    setPortfolioBootstrapFromLocal(false);
    const local = loadPersistedPortfolioStateForUser(userId);
    if (local && local.portfolios.length > 0) {
      applyWorkspaceState(local);
      setPortfolioBootstrapFromLocal(true);
    }
  }, [userId, applyWorkspaceState]);

  /** Load per-user local snapshot, merge with Supabase row, then allow debounced saves. */
  useEffect(() => {
    let cancelled = false;

    startTransition(() => {
      void (async () => {
        const local = loadPersistedPortfolioStateForUser(userId);
        try {
          const res = await fetch("/api/portfolio/workspace", { credentials: "include" });
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
              if (localIsNewer) {
                applyWorkspaceState(local);
                savePersistedPortfolioStateForUser(userId, local);
                await fetch("/api/portfolio/workspace", {
                  method: "PUT",
                  credentials: "include",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ state: local }),
                });
              } else {
                applyWorkspaceState(remote);
                savePersistedPortfolioStateForUser(userId, {
                  ...remote,
                  savedAt: remoteTime > 0 ? remoteTime : Date.now(),
                });
              }
            } else if (local) {
              applyWorkspaceState(local);
              await fetch("/api/portfolio/workspace", {
                method: "PUT",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ state: local }),
              });
            }
          } else if (local) {
            applyWorkspaceState(local);
          }
        } catch {
          if (local) applyWorkspaceState(local);
        } finally {
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
      void fetch("/api/portfolio/workspace", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ state: snapshot }),
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

  /** Sync Supabase community listings when public standard portfolios change (debounced). */
  useEffect(() => {
    if (!workspaceHydrated) return;
    const tid = window.setTimeout(() => {
      void (async () => {
        const publicStandard = portfolios.filter((p) => p.privacy === "public" && !portfolioIsCombined(p));
        const current = new Set(publicStandard.map((p) => p.id));
        const prev = prevPublishedPortfolioIdsRef.current;

        for (const id of prev) {
          if (!current.has(id)) {
            try {
              await fetch("/api/portfolios/listings", {
                method: "PUT",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ portfolioId: id, publish: false }),
              });
            } catch {
              /* ignore */
            }
          }
        }

        for (const p of publicStandard) {
          const holdings = displayHoldingsByPortfolioId[p.id] ?? [];
          const txs = displayTransactionsByPortfolioId[p.id] ?? [];
          const metrics = computePublicPortfolioListingMetrics(holdings, txs);
          try {
            await fetch("/api/portfolios/listings", {
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
          } catch {
            /* ignore */
          }
        }

        prevPublishedPortfolioIdsRef.current = new Set(current);
      })();
    }, 1200);
    return () => window.clearTimeout(tid);
  }, [
    workspaceHydrated,
    portfolios,
    displayHoldingsByPortfolioId,
    displayTransactionsByPortfolioId,
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
      setTransactionsByPortfolioId((prev) => ({
        ...prev,
        [portfolioId]: [...(prev[portfolioId] ?? []), transaction],
      }));
    },
    [portfolios],
  );

  const setPortfolioTransactions = useCallback(
    (portfolioId: string, transactions: PortfolioTransaction[]) => {
      const port = portfolios.find((x) => x.id === portfolioId);
      if (port?.kind === "combined") return;
      setTransactionsByPortfolioId((prev) => ({ ...prev, [portfolioId]: transactions }));
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
      setSelectedPortfolioId(t.portfolioId);
      setEditTransaction(t);
    },
    [portfolios, selectedPortfolioId],
  );

  const closeEditTransaction = useCallback(() => {
    setEditTransaction(null);
  }, []);

  const removePortfolioTransaction = useCallback(
    async (t: PortfolioTransaction) => {
      const view = portfolios.find((x) => x.id === selectedPortfolioId);
      if (view?.kind === "combined") return;
      const pid = t.portfolioId;
      const list = transactionsByPortfolioId[pid] ?? [];
      const next = list.filter((x) => x.id !== t.id);
      setPortfolioTransactions(pid, next);
      setEditTransaction((cur) => (cur?.id === t.id ? null : cur));
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
    setCreateCombinedOpen(true);
  }, []);

  const openNewTransaction = useCallback(() => {
    const p = portfolios.find((x) => x.id === selectedPortfolioId);
    if (p?.kind === "combined") return;
    setNewTransactionOpen(true);
  }, [portfolios, selectedPortfolioId]);
  const closeNewTransaction = useCallback(() => setNewTransactionOpen(false), []);
  const openAddCash = useCallback(() => {
    const p = portfolios.find((x) => x.id === selectedPortfolioId);
    if (p?.kind === "combined") return;
    setAddCashModalOpen(true);
  }, [portfolios, selectedPortfolioId]);
  const closeAddCash = useCallback(() => setAddCashModalOpen(false), []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      if (createPortfolioOpen) {
        setCreatePortfolioOpen(false);
      } else if (createCombinedOpen) {
        setCreateCombinedOpen(false);
      } else if (editPortfolioOpen) {
        setEditPortfolioOpen(false);
        setEditPortfolioId(null);
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
  }, [addCashModalOpen, createCombinedOpen, createPortfolioOpen, editPortfolioOpen, editTransaction, newTransactionOpen]);

  useEffect(() => {
    if (!newTransactionOpen) {
      setEditPortfolioOpen(false);
      setCreatePortfolioOpen(false);
      setCreateCombinedOpen(false);
      setEditPortfolioId(null);
    }
  }, [newTransactionOpen]);

  const portfolioDisplayReady = workspaceHydrated || portfolioBootstrapFromLocal;

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
      selectedPortfolioReadOnly,
      newTransactionOpen,
      openNewTransaction,
      closeNewTransaction,
      addCashModalOpen,
      openAddCash,
      closeAddCash,
      editTransaction,
      openEditTransaction,
      closeEditTransaction,
      setPortfolioTransactions,
      setPortfolioHoldings,
      removePortfolioTransaction,
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
      openEditPortfolio,
      openCreatePortfolio,
      openCreateCombinedPortfolio,
      selectedPortfolioReadOnly,
      newTransactionOpen,
      openNewTransaction,
      closeNewTransaction,
      addCashModalOpen,
      openAddCash,
      closeAddCash,
      editTransaction,
      openEditTransaction,
      closeEditTransaction,
      portfolioDisplayReady,
    ],
  );

  return (
    <PortfolioWorkspaceContext.Provider value={value}>
      {children}
      <NewTransactionModal open={newTransactionOpen} onClose={closeNewTransaction} />
      <AddCashModal open={addCashModalOpen} onClose={closeAddCash} />
      <EditTransactionModal
        open={editTransaction != null}
        transaction={editTransaction}
        onClose={closeEditTransaction}
      />
      {editPortfolioOpen && editPortfolioId ? (
        <EditPortfolioModal
          key={editPortfolioId}
          initialName={portfolios.find((p) => p.id === editPortfolioId)?.name ?? ""}
          initialPrivacy={portfolios.find((p) => p.id === editPortfolioId)?.privacy ?? "private"}
          isCombined={portfolios.find((p) => p.id === editPortfolioId)?.kind === "combined"}
          combinedFromSummary={
            portfolios
              .find((p) => p.id === editPortfolioId)
              ?.combinedFrom?.map((cid) => portfolios.find((x) => x.id === cid)?.name ?? cid)
              .join(", ") ?? ""
          }
          onClose={() => {
            setEditPortfolioOpen(false);
            setEditPortfolioId(null);
          }}
          onSave={(name, nextPrivacy) => {
            const t = name.trim();
            const id = editPortfolioId;
            const editing = portfolios.find((p) => p.id === id);
            if (editing?.kind === "combined") {
              if (t.length === 0) return;
              setPortfolios((prev) => prev.map((p) => (p.id === id ? { ...p, name: t } : p)));
              setEditPortfolioOpen(false);
              setEditPortfolioId(null);
              return;
            }
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
          setDeletePortfolioConfirmId(null);
        }}
      />
      {createPortfolioOpen ? (
        <CreatePortfolioModal
          onClose={() => setCreatePortfolioOpen(false)}
          onAdd={(name, nextPrivacy) => {
            const t = name.trim();
            if (t.length === 0) return;
            const id = newPortfolioId();
            setPortfolios((prev) => [...prev, { id, name: t, privacy: nextPrivacy }]);
            setSelectedPortfolioId(id);
            setCreatePortfolioOpen(false);
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
          }}
        />
      ) : null}
    </PortfolioWorkspaceContext.Provider>
  );
}

export { usePortfolioWorkspace } from "@/components/portfolio/portfolio-workspace-context";
