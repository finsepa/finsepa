"use client";

import type { ReactNode } from "react";
import { startTransition, useCallback, useEffect, useId, useMemo, useState } from "react";
import { X } from "lucide-react";

import { AddCashModal } from "@/components/layout/add-cash-modal";
import { NewTransactionModal } from "@/components/layout/new-transaction-modal";
import { ClearableInput } from "@/components/layout/clearable-input";
import { PortfolioWorkspaceContext } from "@/components/portfolio/portfolio-workspace-context";
import { cn } from "@/lib/utils";
import {
  newPortfolioId,
  type PortfolioEntry,
  type PortfolioHolding,
  type PortfolioTransaction,
} from "@/components/portfolio/portfolio-types";
import {
  loadPersistedPortfolioStateForUser,
  parsePersistedPortfolioUnknown,
  savePersistedPortfolioStateForUser,
  type PersistedPortfolioState,
} from "@/lib/portfolio/portfolio-storage";

function ModalField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex w-full flex-col gap-2">
      <span className="text-sm font-medium leading-5 text-[#09090B]">{label}</span>
      {children}
    </div>
  );
}

function EditPortfolioModal({
  initialName,
  onClose,
  onSave,
  onDelete,
}: {
  initialName: string;
  onClose: () => void;
  onSave: (name: string) => void;
  onDelete: () => void;
}) {
  const titleId = useId();
  const [name, setName] = useState(initialName);

  useEffect(() => {
    setName(initialName);
  }, [initialName]);

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
            Edit portfolio
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

        <div className="px-5 pb-5 pt-5">
          <ModalField label="Name">
            <ClearableInput
              type="text"
              value={name}
              onChange={setName}
              placeholder="Portfolio name"
              clearLabel="Clear name"
            />
          </ModalField>
        </div>

        <div className="flex shrink-0 gap-3 border-t border-[#E4E4E7] px-6 py-4">
          <button
            type="button"
            onClick={onDelete}
            className="flex min-h-9 flex-1 items-center justify-center rounded-[10px] bg-[#F4F4F5] px-4 py-2 text-sm font-medium text-[#09090B] transition-colors hover:bg-[#EBEBEB]"
          >
            Delete
          </button>
          <button
            type="button"
            onClick={() => onSave(name)}
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
  onAdd: (name: string) => void;
}) {
  const titleId = useId();
  const [name, setName] = useState("");
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

        <div className="px-5 pb-5 pt-5">
          <ModalField label="Name">
            <ClearableInput
              type="text"
              value={name}
              onChange={setName}
              placeholder="Enter name"
              clearLabel="Clear name"
            />
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
            onClick={() => onAdd(name)}
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
      list: [{ id, name: "My portfolio" }] as PortfolioEntry[],
      selectedId: id,
    };
  }, []);

  const [portfolios, setPortfolios] = useState<PortfolioEntry[]>(portfolioSeed.list);
  const [selectedPortfolioId, setSelectedPortfolioId] = useState<string | null>(portfolioSeed.selectedId);

  const [editPortfolioOpen, setEditPortfolioOpen] = useState(false);
  const [editPortfolioId, setEditPortfolioId] = useState<string | null>(null);
  const [createPortfolioOpen, setCreatePortfolioOpen] = useState(false);
  const [newTransactionOpen, setNewTransactionOpen] = useState(false);
  const [addCashModalOpen, setAddCashModalOpen] = useState(false);
  const [holdingsByPortfolioId, setHoldingsByPortfolioId] = useState<Record<string, PortfolioHolding[]>>(
    {},
  );
  const [transactionsByPortfolioId, setTransactionsByPortfolioId] = useState<
    Record<string, PortfolioTransaction[]>
  >({});
  /** False until local + server merge has finished (avoids overwriting cloud with the default seed). */
  const [workspaceHydrated, setWorkspaceHydrated] = useState(false);

  const applyWorkspaceState = useCallback((saved: PersistedPortfolioState) => {
    setPortfolios(saved.portfolios);
    setSelectedPortfolioId(saved.selectedPortfolioId);
    setHoldingsByPortfolioId(saved.holdingsByPortfolioId);
    setTransactionsByPortfolioId(saved.transactionsByPortfolioId);
  }, []);

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
            const data = (await res.json()) as { state?: unknown; warning?: string };
            const remote =
              data.state != null ? parsePersistedPortfolioUnknown(data.state) : null;
            if (remote && remote.portfolios.length > 0) {
              applyWorkspaceState(remote);
              savePersistedPortfolioStateForUser(userId, remote);
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

  /** Debounced persist: device + best-effort cloud sync. */
  useEffect(() => {
    if (!workspaceHydrated) return;
    const id = window.setTimeout(() => {
      const snapshot: PersistedPortfolioState = {
        v: 1,
        portfolios,
        selectedPortfolioId,
        holdingsByPortfolioId,
        transactionsByPortfolioId,
      };
      savePersistedPortfolioStateForUser(userId, snapshot);
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

  /** Replaces the row for the same ticker, or appends — supports merged positions after multiple buys. */
  const addHolding = useCallback((portfolioId: string, holding: PortfolioHolding) => {
    setHoldingsByPortfolioId((prev) => {
      const list = [...(prev[portfolioId] ?? [])];
      const sym = holding.symbol.toUpperCase();
      const idx = list.findIndex((h) => h.symbol.toUpperCase() === sym);
      if (idx === -1) list.push(holding);
      else list[idx] = holding;
      return { ...prev, [portfolioId]: list };
    });
  }, []);

  const addTransaction = useCallback((portfolioId: string, transaction: PortfolioTransaction) => {
    setTransactionsByPortfolioId((prev) => ({
      ...prev,
      [portfolioId]: [...(prev[portfolioId] ?? []), transaction],
    }));
  }, []);

  const openEditPortfolio = useCallback((id: string) => {
    setCreatePortfolioOpen(false);
    setEditPortfolioId(id);
    setEditPortfolioOpen(true);
  }, []);

  const openCreatePortfolio = useCallback(() => {
    setEditPortfolioOpen(false);
    setEditPortfolioId(null);
    setCreatePortfolioOpen(true);
  }, []);

  const openNewTransaction = useCallback(() => setNewTransactionOpen(true), []);
  const closeNewTransaction = useCallback(() => setNewTransactionOpen(false), []);
  const openAddCash = useCallback(() => setAddCashModalOpen(true), []);
  const closeAddCash = useCallback(() => setAddCashModalOpen(false), []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      if (createPortfolioOpen) {
        setCreatePortfolioOpen(false);
      } else if (editPortfolioOpen) {
        setEditPortfolioOpen(false);
        setEditPortfolioId(null);
      } else if (addCashModalOpen) {
        setAddCashModalOpen(false);
      } else if (newTransactionOpen) {
        setNewTransactionOpen(false);
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [addCashModalOpen, createPortfolioOpen, editPortfolioOpen, newTransactionOpen]);

  useEffect(() => {
    if (!newTransactionOpen) {
      setEditPortfolioOpen(false);
      setCreatePortfolioOpen(false);
      setEditPortfolioId(null);
    }
  }, [newTransactionOpen]);

  const value = useMemo(
    () => ({
      portfolios,
      selectedPortfolioId,
      setSelectedPortfolioId,
      holdingsByPortfolioId,
      addHolding,
      transactionsByPortfolioId,
      addTransaction,
      openEditPortfolio,
      openCreatePortfolio,
      newTransactionOpen,
      openNewTransaction,
      closeNewTransaction,
      addCashModalOpen,
      openAddCash,
      closeAddCash,
    }),
    [
      portfolios,
      selectedPortfolioId,
      holdingsByPortfolioId,
      addHolding,
      transactionsByPortfolioId,
      addTransaction,
      openEditPortfolio,
      openCreatePortfolio,
      newTransactionOpen,
      openNewTransaction,
      closeNewTransaction,
      addCashModalOpen,
      openAddCash,
      closeAddCash,
    ],
  );

  return (
    <PortfolioWorkspaceContext.Provider value={value}>
      {children}
      <NewTransactionModal open={newTransactionOpen} onClose={closeNewTransaction} />
      <AddCashModal open={addCashModalOpen} onClose={closeAddCash} />
      {editPortfolioOpen && editPortfolioId ? (
        <EditPortfolioModal
          initialName={portfolios.find((p) => p.id === editPortfolioId)?.name ?? ""}
          onClose={() => {
            setEditPortfolioOpen(false);
            setEditPortfolioId(null);
          }}
          onSave={(name) => {
            const t = name.trim();
            const id = editPortfolioId;
            setPortfolios((prev) => {
              if (!id) return prev;
              if (t.length === 0) {
                const next = prev.filter((p) => p.id !== id);
                setSelectedPortfolioId((sel) =>
                  sel !== id ? sel : next[0]?.id ?? null,
                );
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
              return prev.map((p) => (p.id === id ? { ...p, name: t } : p));
            });
            setEditPortfolioOpen(false);
            setEditPortfolioId(null);
          }}
          onDelete={() => {
            const id = editPortfolioId;
            if (!id) return;
            setPortfolios((prev) => {
              const next = prev.filter((p) => p.id !== id);
              setSelectedPortfolioId((sel) =>
                sel !== id ? sel : next[0]?.id ?? null,
              );
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
            setEditPortfolioOpen(false);
            setEditPortfolioId(null);
          }}
        />
      ) : null}
      {createPortfolioOpen ? (
        <CreatePortfolioModal
          onClose={() => setCreatePortfolioOpen(false)}
          onAdd={(name) => {
            const t = name.trim();
            if (t.length === 0) return;
            const id = newPortfolioId();
            setPortfolios((prev) => [...prev, { id, name: t }]);
            setSelectedPortfolioId(id);
            setCreatePortfolioOpen(false);
          }}
        />
      ) : null}
    </PortfolioWorkspaceContext.Provider>
  );
}

export { usePortfolioWorkspace } from "@/components/portfolio/portfolio-workspace-context";
