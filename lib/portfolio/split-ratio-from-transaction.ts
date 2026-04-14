import type { PortfolioTransaction } from "@/components/portfolio/portfolio-types";

/**
 * Some imports store the split ratio in `price` (preferred), others may end up with the ratio in `shares`.
 * We accept either as long as it is a finite number > 0 and != 1.
 */
export function splitRatioFromTransaction(t: PortfolioTransaction): number | null {
  if (t.kind !== "trade") return null;
  if (t.operation.trim().toLowerCase() !== "split") return null;

  const normalize = (raw: number): number | null => {
    if (!Number.isFinite(raw) || raw <= 0 || raw === 1) return null;
    // Some sources encode "10 to 1" as 0.1; our portfolio math expects "new shares per 1 old share".
    const ratio = raw < 1 ? 1 / raw : raw;
    if (!Number.isFinite(ratio) || ratio <= 0 || ratio === 1) return null;
    // Guard against obviously corrupted inputs.
    if (ratio > 1_000_000) return null;
    return ratio;
  };

  const p = normalize(t.price);
  if (p != null) return p;

  const sh = normalize(t.shares);
  if (sh != null) return sh;

  return null;
}

