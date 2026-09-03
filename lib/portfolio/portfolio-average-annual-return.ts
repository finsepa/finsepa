import type { PortfolioPeriodReturnBar } from "@/lib/portfolio/portfolio-period-returns-types";

/** Arithmetic mean of annual Modified Dietz returns (same bars as Returns Dynamics → Annually). */
export function averageAnnualPortfolioReturnPct(
  bars: readonly PortfolioPeriodReturnBar[],
): number | null {
  const values: number[] = [];
  for (const bar of bars) {
    const pct = bar.portfolioPct;
    if (pct != null && Number.isFinite(pct)) values.push(pct);
  }
  if (values.length === 0) return null;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}
