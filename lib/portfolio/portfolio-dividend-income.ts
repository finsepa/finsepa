import type { PortfolioHolding } from "@/components/portfolio/portfolio-types";

/**
 * Portfolio dividend income + yield from per-symbol fundamentals yields (%).
 *
 * Yield is **portfolio-level**: annual income ÷ total equity market value.
 * Holdings without yield data (e.g. crypto) count as 0% — they dilute the portfolio
 * yield. Do **not** average only among dividend payers (that overstates yield).
 *
 * Matches iOS `PortfolioMapping.dividendIncome`.
 */
export function portfolioDividendIncome(
  holdings: readonly Pick<PortfolioHolding, "symbol" | "currentValue">[],
  yieldBySymbol: Readonly<Record<string, number | null | undefined>>,
): { annualUsd: number | null; yieldPct: number | null } {
  let equity = 0;
  for (const h of holdings) {
    if (Number.isFinite(h.currentValue)) equity += h.currentValue;
  }
  if (!(equity > 0)) return { annualUsd: null, yieldPct: null };

  let annual = 0;
  let any = false;
  for (const h of holdings) {
    const y = yieldBySymbol[h.symbol.trim().toUpperCase()];
    if (y == null || !Number.isFinite(y)) continue;
    any = true;
    annual += h.currentValue * (y / 100);
  }
  if (!any) return { annualUsd: null, yieldPct: null };

  return { annualUsd: annual, yieldPct: (annual / equity) * 100 };
}
