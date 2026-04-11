"use client";

import { createContext, useContext } from "react";
import type { Dispatch, SetStateAction } from "react";

import type {
  PortfolioEntry,
  PortfolioHolding,
  PortfolioTransaction,
} from "@/components/portfolio/portfolio-types";

export type PortfolioWorkspaceContextValue = {
  portfolios: PortfolioEntry[];
  selectedPortfolioId: string | null;
  setSelectedPortfolioId: Dispatch<SetStateAction<string | null>>;
  holdingsByPortfolioId: Record<string, PortfolioHolding[]>;
  addHolding: (portfolioId: string, holding: PortfolioHolding) => void;
  transactionsByPortfolioId: Record<string, PortfolioTransaction[]>;
  addTransaction: (portfolioId: string, transaction: PortfolioTransaction) => void;
  openEditPortfolio: (id: string) => void;
  openCreatePortfolio: () => void;
  openCreateCombinedPortfolio: () => void;
  /** True when the selected portfolio is a read-only combined view (no trades / imports). */
  selectedPortfolioReadOnly: boolean;
  newTransactionOpen: boolean;
  openNewTransaction: () => void;
  closeNewTransaction: () => void;
  addCashModalOpen: boolean;
  openAddCash: () => void;
  closeAddCash: () => void;
  /** Row being edited in `EditTransactionModal` (null when closed). */
  editTransaction: PortfolioTransaction | null;
  openEditTransaction: (t: PortfolioTransaction) => void;
  closeEditTransaction: () => void;
  /** Replace the full ledger for one portfolio (used after editing a row + rebuild). */
  setPortfolioTransactions: (portfolioId: string, transactions: PortfolioTransaction[]) => void;
  setPortfolioHoldings: (portfolioId: string, holdings: PortfolioHolding[]) => void;
  /** Remove one ledger row and rebuild holdings from remaining trades (closes edit modal if it matched). */
  removePortfolioTransaction: (transaction: PortfolioTransaction) => Promise<void>;
  /** Re-insert a removed row and rebuild holdings (e.g. Sonner undo). */
  restorePortfolioTransaction: (transaction: PortfolioTransaction) => Promise<void>;
  /**
   * True once we can show portfolio totals without flashing the default empty seed:
   * either a local snapshot was applied, or the server merge finished.
   */
  portfolioDisplayReady: boolean;
};

export const PortfolioWorkspaceContext = createContext<PortfolioWorkspaceContextValue | null>(null);

export function usePortfolioWorkspace(): PortfolioWorkspaceContextValue {
  const ctx = useContext(PortfolioWorkspaceContext);
  if (!ctx) {
    throw new Error("usePortfolioWorkspace must be used within PortfolioWorkspaceProvider");
  }
  return ctx;
}
