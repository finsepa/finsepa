import { formatFinancialsPeriodEndDisplay } from "@/lib/market/charting-period-display";
import {
  annualEpsGrowthSeries,
  annualRevenueGrowthSeries,
  displayEps,
  displayRevenueUsd,
  sliceLatestAnnualEstimates,
} from "@/lib/market/earnings-annual-display";
import type {
  IncomeStatementTableModel,
  IncomeStatementRowModel,
} from "@/lib/market/stock-financials-income-table";
import type { FundamentalsSeriesMode } from "@/lib/market/charting-series-types";
import type { StockEarningsEstimatesPoint } from "@/lib/market/stock-earnings-types";

function earningsSummaryRows(
  revenueVals: (number | null)[],
  revGrowth: (number | null)[],
  epsVals: (number | null)[],
  epsGrowth: (number | null)[],
): IncomeStatementRowModel[] {
  return [
    {
      id: "revenue",
      label: "Revenue",
      emphasize: true,
      format: "usd",
      values: revenueVals,
      subValues: revGrowth,
      chartingMetricId: "revenue",
    },
    {
      id: "eps",
      label: "EPS",
      emphasize: true,
      format: "perShare",
      values: epsVals,
      subValues: epsGrowth,
      chartingMetricId: "eps",
    },
  ];
}

/** Legacy column-oriented annual summary (history + forward) for {@link EarningsAnnualSummaryTable}. */
export function buildEarningsAnnualSummaryTableModel(
  annual: StockEarningsEstimatesPoint[],
): IncomeStatementTableModel | null {
  const cols = sliceLatestAnnualEstimates(annual);
  if (cols.length === 0) return null;

  const columns = cols.map((p) => p.label);
  const columnPeriodEnds = cols.map((p) =>
    /^\d{4}-\d{2}-\d{2}$/.test(p.sortKey)
      ? formatFinancialsPeriodEndDisplay(p.sortKey)
      : "—",
  );

  const revenueVals = cols.map(displayRevenueUsd);
  const revGrowth = annualRevenueGrowthSeries(cols);
  const epsVals = cols.map(displayEps);
  const epsGrowth = annualEpsGrowthSeries(cols);

  return {
    periodColumnHeader: "",
    columns,
    columnPeriodEnds,
    rows: earningsSummaryRows(revenueVals, revGrowth, epsVals, epsGrowth),
  };
}

/**
 * Forward P/E for a consensus period: price ÷ annualized EPS.
 * Quarterly EPS is annualized ×4 so the multiple stays on a yearly footing.
 */
export function forwardPeForPoint(
  point: StockEarningsEstimatesPoint,
  periodMode: FundamentalsSeriesMode,
  lastPrice: number | null,
): number | null {
  const eps = displayEps(point);
  if (lastPrice == null || !Number.isFinite(lastPrice) || lastPrice <= 0) return null;
  if (eps == null || !Number.isFinite(eps) || eps <= 0) return null;
  const annualized = periodMode === "quarterly" ? eps * 4 : eps;
  if (annualized <= 0) return null;
  const pe = lastPrice / annualized;
  if (!Number.isFinite(pe) || pe <= 0 || pe > 1e6) return null;
  return pe;
}

