"use client";

import { useMemo, type ReactNode } from "react";

import {
  PortfolioWorkspaceContext,
  type PortfolioWorkspaceContextValue,
} from "@/components/portfolio/portfolio-workspace-context";
import type { PortfolioHolding, PortfolioTransaction } from "@/components/portfolio/portfolio-types";

export const PUBLIC_PORTFOLIO_VIEW_ID = "public-portfolio-view";

const noop = () => {};
const noopAsync = async () => {};

export function PublicPortfolioViewProvider({
  portfolioName,
  holdings,
  transactions,
  children,
}: {
  portfolioName: string;
  holdings: PortfolioHolding[];
  transactions: PortfolioTransaction[];
  children: ReactNode;
}) {
  const normalizedTx = useMemo(
    () =>
      transactions.map((t) => ({
        ...t,
        portfolioId: PUBLIC_PORTFOLIO_VIEW_ID,
      })),
    [transactions],
  );

  const value = useMemo((): PortfolioWorkspaceContextValue => {
    const pid = PUBLIC_PORTFOLIO_VIEW_ID;
    return {
      portfolios: [{ id: pid, name: portfolioName, privacy: "public" }],
      selectedPortfolioId: pid,
      setSelectedPortfolioId: noop as PortfolioWorkspaceContextValue["setSelectedPortfolioId"],
      holdingsByPortfolioId: { [pid]: holdings },
      addHolding: noop,
      transactionsByPortfolioId: { [pid]: normalizedTx },
      addTransaction: noop,
      openEditPortfolio: noop,
      openCreatePortfolio: noop,
      openCreateCombinedPortfolio: noop,
      openConnectBrokerage: noop,
      openSnaptradeSyncModal: noop,
      resyncLinkedPortfolio: async () => {},
      updatePortfolioPrivacy: noop,
      selectedPortfolioReadOnly: true,
      newTransactionOpen: false,
      openNewTransaction: noop,
      openNewTransactionWithPreset: noop,
      closeNewTransaction: noop,
      addCashModalOpen: false,
      openAddCash: noop,
      closeAddCash: noop,
      openImportTransactions: noop,
      editTransaction: null,
      openEditTransaction: noop,
      closeEditTransaction: noop,
      setPortfolioTransactions: noop,
      setPortfolioHoldings: noop,
      removePortfolioTransaction: noopAsync,
      removePortfolioTransactions: noopAsync,
      restorePortfolioTransaction: noopAsync,
      portfolioDisplayReady: true,
    };
  }, [holdings, normalizedTx, portfolioName]);

  return (
    <PortfolioWorkspaceContext.Provider value={value}>{children}</PortfolioWorkspaceContext.Provider>
  );
}
