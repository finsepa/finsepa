import type { PortfolioHolding, PortfolioTransaction } from "@/components/portfolio/portfolio-types";
import {
  buildTopNAllocationRows,
  type AllocationDonutRow,
} from "@/lib/portfolio/allocation-donut-rows";
import { netCashUsd } from "@/lib/portfolio/overview-metrics";

export function buildPortfolioAllocationRows(
  holdings: PortfolioHolding[],
  transactions: PortfolioTransaction[],
): AllocationDonutRow[] {
  const cashUsd = netCashUsd(transactions);
  const equity = holdings.reduce((s, h) => s + h.currentValue, 0);
  const allocationDenomUsd = equity + Math.max(0, cashUsd);
  if (allocationDenomUsd <= 0) return [];

  const raw = holdings.map((h) => ({
    id: h.id,
    name: h.name.trim() || h.symbol,
    symbol: h.symbol.trim().toUpperCase() || h.name.trim(),
    weightPct: (h.currentValue / allocationDenomUsd) * 100,
    logoUrl: h.logoUrl,
  }));

  if (cashUsd > 0) {
    raw.push({
      id: "cash-usd",
      name: "US Dollar",
      symbol: "USD",
      weightPct: (cashUsd / allocationDenomUsd) * 100,
      logoUrl: null,
    });
  }

  return buildTopNAllocationRows(raw);
}
