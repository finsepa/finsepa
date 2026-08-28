"use client";

import { createContext, useContext } from "react";
import type { Dispatch, SetStateAction } from "react";

import type { CompanyPick } from "@/components/charting/company-picker";
import type {
  PortfolioEntry,
  PortfolioHolding,
  PortfolioPrivacy,
  PortfolioTransaction,
} from "@/components/portfolio/portfolio-types";

export type PortfolioWorkspaceContextValue = {
  portfolios: PortfolioEntry[];
  selectedPortfolioId: string | null;
  setSelectedPortfolioId: Dispatch<SetStateAction<string | null>>;
  /** Free: whether this portfolio can be opened (active manual, brokerage offline, demo). */
  isFreePortfolioAccessible: (portfolioId: string | null) => boolean;
  holdingsByPortfolioId: Record<string, PortfolioHolding[]>;
  addHolding: (portfolioId: string, holding: PortfolioHolding) => void;
  transactionsByPortfolioId: Record<string, PortfolioTransaction[]>;
  addTransaction: (portfolioId: string, transaction: PortfolioTransaction) => void;
  openEditPortfolio: (id: string) => void;
  openCreatePortfolio: () => void;
  openCreateCombinedPortfolio: () => void;
  openConnectBrokerage: () => void;
  /**
   * Empty-portfolio setup: open SnapTrade institution picker for the selected portfolio
   * (uses its existing name/privacy; does not ask again). Pro only.
   */
  openConnectBrokerageToSelected: () => void;
  /**
   * Pro: open SnapTrade portal and re-link into an existing offline (or linked) brokerage portfolio.
   * Free: sends the user to Plans.
   */
  openReconnectBrokerage: (portfolioId: string) => void;
  /** Seed (or convert the empty selected portfolio into) the Free demo sample — keeps the portfolio name when converting. */
  openTryDemoPortfolio: () => void;
  /** Re-pull holdings and cash from SnapTrade for a linked portfolio (no paid refresh endpoint). */
  resyncLinkedPortfolio: (
    portfolioId: string,
    options?: { silent?: boolean; updateFromYmd?: string | null; authorizationIdOverride?: string },
  ) => Promise<void>;
  /** Open the manual brokerage sync modal (update-from date + sync settings link). */
  openSnaptradeSyncModal: (portfolioId: string) => void;
  /** Updates visibility for a portfolio and syncs the public listing (same behavior as Edit → Save). */
  updatePortfolioPrivacy: (portfolioId: string, nextPrivacy: PortfolioPrivacy) => void;
  /**
   * True when the selected portfolio is read-only for ledger edits: combined aggregate, demo sample,
   * or a Free offline/brokerage freeze (no trades / imports / sync). Rename/delete in Edit still allowed.
   */
  selectedPortfolioReadOnly: boolean;
  newTransactionOpen: boolean;
  openNewTransaction: () => void;
  /** Open New Transaction with a pre-selected ticker/crypto symbol. */
  openNewTransactionWithPreset: (pick: CompanyPick) => void;
  closeNewTransaction: () => void;
  addCashModalOpen: boolean;
  openAddCash: () => void;
  closeAddCash: () => void;
  openImportTransactions: () => void;
  /** Row being edited in `EditTransactionModal` (null when closed). */
  editTransaction: PortfolioTransaction | null;
  openEditTransaction: (t: PortfolioTransaction) => void;
  closeEditTransaction: () => void;
  /** Replace the full ledger for one portfolio (used after editing a row + rebuild). */
  setPortfolioTransactions: (portfolioId: string, transactions: PortfolioTransaction[]) => void;
  setPortfolioHoldings: (portfolioId: string, holdings: PortfolioHolding[]) => void;
  /** Remove one ledger row and rebuild holdings from remaining trades (closes edit modal if it matched). */
  removePortfolioTransaction: (transaction: PortfolioTransaction) => Promise<void>;
  /** Remove many ledger rows by id (same rebuild as single delete; closes edit modal if its row is included). */
  removePortfolioTransactions: (portfolioId: string, ids: ReadonlySet<string>) => Promise<void>;
  /** Re-insert a removed row and rebuild holdings (e.g. Sonner undo). */
  restorePortfolioTransaction: (transaction: PortfolioTransaction) => Promise<void>;
  /**
   * True once workspace data is loaded (local snapshot and/or server merge) **and** a live
   * mark-to-market quote pass has finished for holdings rebuilt from the ledger (avoids briefly
   * showing totals from last trade prices before refreshed `currentValue`, especially crypto).
   */
  portfolioDisplayReady: boolean;
  /** True after local bootstrap and/or server merge — portfolio list is trustworthy. */
  portfolioListReady: boolean;
};

export const PortfolioWorkspaceContext = createContext<PortfolioWorkspaceContextValue | null>(null);

export function usePortfolioWorkspace(): PortfolioWorkspaceContextValue {
  const ctx = useContext(PortfolioWorkspaceContext);
  if (!ctx) {
    throw new Error("usePortfolioWorkspace must be used within PortfolioWorkspaceProvider");
  }
  return ctx;
}
