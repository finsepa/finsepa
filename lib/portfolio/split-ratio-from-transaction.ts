import type { PortfolioTransaction } from "@/components/portfolio/portfolio-types";
import { normalizeSplitRatio } from "@/lib/market/parse-eodhd-split-ratio";

/**
 * Resolve split ratio as **new shares per 1 old share**.
 * Prefer `price` (imports + corporate-action sync); fall back to `shares` when price is unused.
 * Accepts reverse splits (0 < ratio < 1). Does **not** invert fractions — store `10` for 10:1
 * and `0.1` for a 1:10 reverse split.
 */
export function splitRatioFromTransaction(t: PortfolioTransaction): number | null {
  if (t.kind !== "trade") return null;
  if (t.operation.trim().toLowerCase() !== "split") return null;

  const p = normalizeSplitRatio(t.price);
  if (p != null) return p;

  return normalizeSplitRatio(t.shares);
}

