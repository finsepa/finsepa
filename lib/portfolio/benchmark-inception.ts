import type { PortfolioTransaction } from "@/components/portfolio/portfolio-types";
import { splitRatioFromTransaction } from "@/lib/portfolio/split-ratio-from-transaction";

/** Earliest calendar day of a stock buy (YYYY-MM-DD). */
export function earliestStockBuyYmd(transactions: PortfolioTransaction[]): string | null {
  let min: string | null = null;
  for (const t of transactions) {
    if (t.kind !== "trade") continue;
    if (t.operation.toLowerCase() !== "buy") continue;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(t.date)) continue;
    if (min == null || t.date < min) min = t.date;
  }
  return min;
}

/**
 * Replay trades up to and including {@link asOfYmd} (inclusive); returns shares held per symbol.
 */
export function replayStockSharesUpTo(
  transactions: PortfolioTransaction[],
  asOfYmd: string,
): Map<string, number> {
  const trades = transactions
    .filter((t) => t.kind === "trade")
    .sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return 0;
    });

  const m = new Map<string, number>();
  for (const t of trades) {
    if (t.date > asOfYmd) break;
    const sym = t.symbol.toUpperCase();
    const prev = m.get(sym) ?? 0;
    const op = t.operation.toLowerCase();
    if (op === "buy") {
      m.set(sym, prev + t.shares);
    } else if (op === "split") {
      const ratio = splitRatioFromTransaction(t);
      if (prev > 0 && ratio != null) m.set(sym, prev * ratio);
    } else if (op === "sell") {
      m.set(sym, Math.max(0, prev - t.shares));
    }
  }
  return m;
}

/**
 * Net cash contributed to equity positions **after** {@link afterYmd} (exclusive of that day).
 * Buy rows use negative `sum` (cash out); sells positive. Sum of `-sum` matches Dietz net flow.
 */
export function netCashIntoEquityAfter(transactions: PortfolioTransaction[], afterYmd: string): number {
  let f = 0;
  for (const t of transactions) {
    if (t.kind !== "trade") continue;
    if (t.date <= afterYmd) continue;
    f += -t.sum;
  }
  return f;
}

/**
 * Modified Dietz return (%) from inception through now for a portfolio with external flows.
 * See https://en.wikipedia.org/wiki/Modified_Dietz_method
 */
export function modifiedDietzReturnPct(vStart: number, vEnd: number, netFlow: number): number | null {
  const denom = vStart + netFlow / 2;
  if (!Number.isFinite(denom) || denom <= 0) return null;
  const num = vEnd - vStart - netFlow;
  if (!Number.isFinite(num)) return null;
  return (num / denom) * 100;
}
