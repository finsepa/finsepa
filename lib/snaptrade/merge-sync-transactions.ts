import type { PortfolioTransaction } from "@/components/portfolio/portfolio-types";

export function portfolioTransactionDedupeKey(
  t: Pick<PortfolioTransaction, "date" | "operation" | "symbol" | "shares" | "price">,
): string {
  const shares = Math.round(t.shares * 10000) / 10000;
  const price = Math.round(t.price * 100) / 100;
  const symbol = t.symbol ?? "";
  return `${t.date}|${t.operation}|${symbol}|${shares}|${price}`;
}

/** Keep older ledger rows and append imported sync rows (deduped). */
export function mergePortfolioSnaptradeSync(
  kept: PortfolioTransaction[],
  imported: PortfolioTransaction[],
): PortfolioTransaction[] {
  const seen = new Set(imported.map(portfolioTransactionDedupeKey));
  const filteredKept = kept.filter((t) => !seen.has(portfolioTransactionDedupeKey(t)));
  return [...filteredKept, ...imported].sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    const kindOrder = (k: PortfolioTransaction["kind"]) => (k === "cash" ? 0 : k === "trade" ? 1 : 2);
    return kindOrder(a.kind) - kindOrder(b.kind);
  });
}
