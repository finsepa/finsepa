/** Large USD amounts: $66.17B, $71.34K, etc. */
export function formatUsdCompact(n: number): string {
  if (!Number.isFinite(n)) return "—";
  const abs = Math.abs(n);
  if (abs >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (abs >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `$${(n / 1e3).toFixed(2)}K`;
  return `$${n.toFixed(2)}`;
}

/** Shares count → e.g. 1,022.33M */
export function formatSharesOutstanding(n: number): string {
  if (!Number.isFinite(n)) return "—";
  const m = n / 1e6;
  return `${m.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}M`;
}

/** Stock-style USD price */
export function formatUsdPrice(n: number): string {
  if (!Number.isFinite(n)) return "—";
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatBeta(n: number): string {
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function formatEmployeesCount(n: number): string {
  if (!Number.isFinite(n)) return "—";
  return Math.round(n).toLocaleString("en-US");
}

/**
 * Provider may send ratio (0.2203) or percent points (22.03).
 * Values with |x| ≤ 1 (and nonzero) are treated as ratios × 100.
 */
export function formatPercentMetric(n: number): string {
  if (!Number.isFinite(n)) return "—";
  const p = Math.abs(n) <= 1 && n !== 0 ? n * 100 : n;
  return `${p.toLocaleString("en-US", { maximumFractionDigits: 2, minimumFractionDigits: 2 })}%`;
}

/** Valuation multiples (P/E, EV/EBITDA, etc.) */
export function formatRatio(n: number): string {
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString("en-US", { maximumFractionDigits: 2, minimumFractionDigits: 2 });
}
