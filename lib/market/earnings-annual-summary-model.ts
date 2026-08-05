import {
  formatChartingPeriodAxisLabel,
  formatFinancialsPeriodEndDisplay,
} from "@/lib/market/charting-period-display";
import {
  annualEpsGrowthSeries,
  annualRevenueGrowthSeries,
  displayEps,
  displayRevenueUsd,
  partitionEstimatePoints,
  sliceForwardAnnualEstimates,
  sliceForwardQuarterlyEstimates,
  sliceLatestAnnualEstimates,
} from "@/lib/market/earnings-annual-display";
import { formatRatio, formatUsdCompact } from "@/lib/market/key-stats-basic-format";
import { pctChange } from "@/lib/market/stock-financials-annual-slice";
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

export type FuturePeriodsTableRow = {
  key: string;
  /** Period label — `2027` or `Q3 '26`. */
  periodLabel: string;
  revenueDisplay: string;
  revenueYoyPct: number | null;
  epsDisplay: string;
  epsYoyPct: number | null;
  forwardPeDisplay: string;
};

function formatEpsCell(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return "-";
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatRevenueCell(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return "-";
  // Match income-statement compact style without leading `$` (e.g. `129.76B`).
  return formatUsdCompact(n).replace(/^\$/, "");
}

function yearAgoLabel(label: string): string | null {
  const q = label.trim().match(/^(Q[1-4])\s+(\d{4})$/i);
  if (q) return `${q[1]!.toUpperCase()} ${Number(q[2]) - 1}`;
  if (/^\d{4}$/.test(label.trim())) return String(Number(label.trim()) - 1);
  return null;
}

function findYearAgoPoint(
  all: readonly StockEarningsEstimatesPoint[],
  point: StockEarningsEstimatesPoint,
): StockEarningsEstimatesPoint | null {
  const targetLabel = yearAgoLabel(point.label);
  if (targetLabel) {
    const byLabel = all.find((p) => p.label === targetLabel);
    if (byLabel) return byLabel;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(point.sortKey)) {
    const y = Number(point.sortKey.slice(0, 4)) - 1;
    const md = point.sortKey.slice(4);
    const exact = all.find((p) => p.sortKey === `${y}${md}`);
    if (exact) return exact;
  }
  return null;
}

function yoyPct(current: number | null, prior: number | null): number | null {
  if (current == null || prior == null || !Number.isFinite(current) || !Number.isFinite(prior)) {
    return null;
  }
  return pctChange(current, prior);
}

/**
 * Forward P/E for a consensus period: price ÷ annualized EPS.
 * Quarterly EPS is annualized ×4 so the multiple stays on a yearly footing.
 */
function forwardPeForPoint(
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

function periodAxisLabel(point: StockEarningsEstimatesPoint, periodMode: FundamentalsSeriesMode): string {
  if (periodMode === "quarterly" && /^\d{4}-\d{2}-\d{2}$/.test(point.sortKey)) {
    return formatChartingPeriodAxisLabel(point.sortKey, "quarterly");
  }
  return point.label;
}

/** Future periods — one row per upcoming year / quarter. */
export function buildFuturePeriodsTableRows(
  chart: { annual: StockEarningsEstimatesPoint[]; quarterly: StockEarningsEstimatesPoint[] },
  periodMode: FundamentalsSeriesMode,
  lastPrice: number | null,
): FuturePeriodsTableRow[] {
  const forward =
    periodMode === "annual"
      ? sliceForwardAnnualEstimates(chart.annual)
      : sliceForwardQuarterlyEstimates(chart.quarterly);
  if (forward.length === 0) return [];

  const all = periodMode === "annual" ? chart.annual : chart.quarterly;
  const { historical } = partitionEstimatePoints(all);
  const lookupPool = [...historical, ...forward];

  return forward.map((point) => {
    const yearAgo = findYearAgoPoint(lookupPool, point);
    const rev = displayRevenueUsd(point);
    const eps = displayEps(point);
    const revPrior = yearAgo ? displayRevenueUsd(yearAgo) : null;
    const epsPrior = yearAgo ? displayEps(yearAgo) : null;
    const pe = forwardPeForPoint(point, periodMode, lastPrice);

    return {
      key: point.sortKey,
      periodLabel: periodAxisLabel(point, periodMode),
      revenueDisplay: formatRevenueCell(rev),
      revenueYoyPct: yoyPct(rev, revPrior),
      epsDisplay: formatEpsCell(eps),
      epsYoyPct: yoyPct(eps, epsPrior),
      forwardPeDisplay: pe != null ? formatRatio(pe) : "-",
    };
  });
}
