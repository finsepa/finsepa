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
};

export const PortfolioWorkspaceContext = createContext<PortfolioWorkspaceContextValue | null>(null);

export function usePortfolioWorkspace(): PortfolioWorkspaceContextValue {
  const ctx = useContext(PortfolioWorkspaceContext);
  if (!ctx) {
    throw new Error("usePortfolioWorkspace must be used within PortfolioWorkspaceProvider");
  }
  return ctx;
}
