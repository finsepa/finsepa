/** Large USD amounts: $66.17B, -$773.05M, etc. */
export function formatUsdCompact(n: number): string {
  if (!Number.isFinite(n)) return "—";
  const neg = n < 0;
  const abs = Math.abs(n);
  const prefix = neg ? "-$" : "$";
  if (abs >= 1e12) return `${prefix}${(abs / 1e12).toFixed(2)}T`;
  if (abs >= 1e9) return `${prefix}${(abs / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${prefix}${(abs / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `${prefix}${(abs / 1e3).toFixed(2)}K`;
  return `${prefix}${abs.toFixed(2)}`;
}

/** Round to the same precision as {@link formatUsdCompact} before period-over-period USD deltas. */
export function roundToUsdCompactPrecision(n: number): number {
  if (!Number.isFinite(n)) return n;
  const abs = Math.abs(n);
  const sign = n < 0 ? -1 : 1;
  if (abs >= 1e12) return sign * Math.round(abs / 1e10) * 1e10;
  if (abs >= 1e9) return sign * Math.round(abs / 1e7) * 1e7;
  if (abs >= 1e6) return sign * Math.round(abs / 1e4) * 1e4;
  if (abs >= 1e3) return sign * Math.round(abs / 10) * 10;
  return sign * Math.round(abs * 100) / 100;
}

/**
 * Compact USD with at most `sigDigits` significant figures in the mantissa
 * (e.g. `$91.91B`, `$275B`, `$1.024K`). Uses the same K/M/B/T tiers as {@link formatUsdCompact}.
 */
export function formatUsdCompactSigDigits(n: number, sigDigits: number = 4): string {
  if (!Number.isFinite(n)) return "—";
  if (n === 0) return "$0";
  const neg = n < 0;
  const abs = Math.abs(n);

  const mantissa = (quotient: number, suffix: string): string => {
    const rounded = Number.parseFloat(quotient.toPrecision(sigDigits));
    let t = String(rounded);
    if (t.includes("e") || t.includes("E")) {
      t = rounded.toFixed(8).replace(/\.?0+$/, "");
    }
    return `${neg ? "-" : ""}$${t}${suffix}`;
  };

  if (abs >= 1e12) return mantissa(abs / 1e12, "T");
  if (abs >= 1e9) return mantissa(abs / 1e9, "B");
  if (abs >= 1e6) return mantissa(abs / 1e6, "M");
  if (abs >= 1e3) return mantissa(abs / 1e3, "K");
  const rounded = Number.parseFloat(abs.toPrecision(sigDigits));
  let t = String(rounded);
  if (t.includes("e") || t.includes("E")) {
    t = rounded.toFixed(8).replace(/\.?0+$/, "");
  }
  return `${neg ? "-" : ""}$${t}`;
}

/** Shares count → e.g. 14.7B, 502.33M */
export function formatSharesOutstanding(n: number): string {
  if (!Number.isFinite(n)) return "—";
  const abs = Math.abs(n);
  if (abs >= 1e9) return `${(n / 1e9).toFixed(1)}B`;
  if (abs >= 1e6) return `${(n / 1e6).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}M`;
  if (abs >= 1e3) return `${(n / 1e3).toFixed(2)}K`;
  return n.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

/** Stock-style USD price */
export function formatUsdPrice(n: number): string {
  if (!Number.isFinite(n)) return "—";
  const neg = n < 0;
  const abs = Math.abs(n);
  const body = abs.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return neg ? `-$${body}` : `$${body}`;
}

/** Dollar amount with grouping, no currency symbol (e.g. header change `-3,700.00`). */
export function formatUsdAmountGrouped2dp(n: number): string {
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function formatBeta(n: number): string {
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Headcount → e.g. 166.00K, 1.50M */
export function formatEmployeesCount(n: number): string {
  if (!Number.isFinite(n)) return "—";
  const abs = Math.abs(n);
  if (abs >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `${(n / 1e3).toFixed(2)}K`;
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
