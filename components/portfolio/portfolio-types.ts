export type PortfolioEntry = { id: string; name: string };

/** One lot / line in the portfolio holdings table (local UI until backend exists). */
export type PortfolioHolding = {
  id: string;
  symbol: string;
  name: string;
  logoUrl: string | null;
  shares: number;
  /** Weighted average cost per share including fees (total paid ÷ shares). */
  avgPrice: number;
  /** Total amount paid for shares still held (incl. fees). Does not float with the stock price. */
  costBasis: number;
  currentValue: number;
  /** Last market price used for current value. */
  marketPrice: number;
};

export function newPortfolioId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `p-${Math.random().toString(36).slice(2, 12)}`;
}

export function newHoldingId(): string {
  return newPortfolioId();
}

export type PortfolioTransactionKind = "trade" | "cash" | "income";

/** Ledger row for the Transactions tab (local UI until backend exists). */
export type PortfolioTransaction = {
  id: string;
  portfolioId: string;
  kind: PortfolioTransactionKind;
  /** Buy, Sell, Cash In, Cash Out, Dividend, … */
  operation: string;
  symbol: string;
  name: string;
  logoUrl: string | null;
  /** ISO date yyyy-MM-dd */
  date: string;
  shares: number;
  price: number;
  fee: number;
  /** Signed cash flow: negative = paid out, positive = received. */
  sum: number;
  profitPct: number | null;
  profitUsd: number | null;
  /** Set for trade rows tied to a holding lot. */
  holdingId?: string;
};

export function newTransactionRowId(): string {
  return newPortfolioId();
}
