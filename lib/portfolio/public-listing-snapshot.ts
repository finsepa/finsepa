import type { PortfolioHolding, PortfolioTransaction } from "@/components/portfolio/portfolio-types";

const MAX_SNAPSHOT_HOLDINGS = 150;
const MAX_SNAPSHOT_TRANSACTIONS = 4000;

export type PublicPortfolioListingSnapshot = {
  holdings: PortfolioHolding[];
  transactions: PortfolioTransaction[];
};

function isHoldingRow(v: unknown): v is PortfolioHolding {
  if (!v || typeof v !== "object") return false;
  const o = v as PortfolioHolding;
  return (
    typeof o.id === "string" &&
    typeof o.symbol === "string" &&
    typeof o.name === "string" &&
    typeof o.shares === "number" &&
    Number.isFinite(o.shares) &&
    typeof o.avgPrice === "number" &&
    Number.isFinite(o.avgPrice) &&
    typeof o.costBasis === "number" &&
    Number.isFinite(o.costBasis) &&
    typeof o.currentValue === "number" &&
    Number.isFinite(o.currentValue) &&
    typeof o.marketPrice === "number" &&
    Number.isFinite(o.marketPrice)
  );
}

function isTransactionRow(v: unknown): v is PortfolioTransaction {
  if (!v || typeof v !== "object") return false;
  const o = v as PortfolioTransaction;
  return (
    typeof o.id === "string" &&
    typeof o.portfolioId === "string" &&
    typeof o.kind === "string" &&
    typeof o.operation === "string" &&
    typeof o.symbol === "string" &&
    typeof o.name === "string" &&
    typeof o.date === "string" &&
    typeof o.shares === "number" &&
    Number.isFinite(o.shares) &&
    typeof o.price === "number" &&
    Number.isFinite(o.price) &&
    typeof o.fee === "number" &&
    Number.isFinite(o.fee) &&
    typeof o.sum === "number" &&
    Number.isFinite(o.sum)
  );
}

export function buildPublicListingSnapshot(
  holdings: PortfolioHolding[],
  transactions: PortfolioTransaction[],
): PublicPortfolioListingSnapshot | undefined {
  if (holdings.length === 0 && transactions.length === 0) return undefined;
  return {
    holdings: holdings.slice(0, MAX_SNAPSHOT_HOLDINGS),
    transactions: transactions.slice(0, MAX_SNAPSHOT_TRANSACTIONS),
  };
}

export function sanitizePublicListingSnapshot(input: unknown): PublicPortfolioListingSnapshot | undefined {
  if (!input || typeof input !== "object") return undefined;
  const o = input as { holdings?: unknown; transactions?: unknown };
  const holdings = Array.isArray(o.holdings) ? o.holdings.filter(isHoldingRow).slice(0, MAX_SNAPSHOT_HOLDINGS) : [];
  const transactions = Array.isArray(o.transactions) ?
      o.transactions.filter(isTransactionRow).slice(0, MAX_SNAPSHOT_TRANSACTIONS)
    : [];
  if (holdings.length === 0 && transactions.length === 0) return undefined;
  return { holdings, transactions };
}

export function parsePublicListingSnapshotFromMetrics(
  metrics: Record<string, unknown>,
): PublicPortfolioListingSnapshot | null {
  const snap = sanitizePublicListingSnapshot(metrics.snapshot);
  return snap ?? null;
}
