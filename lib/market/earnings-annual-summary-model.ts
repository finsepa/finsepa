import {
  formatChartingPeriodAxisLabel,
  formatFinancialsPeriodEndDisplay,
} from "@/lib/market/charting-period-display";
import {
  annualEpsGrowthSeries,
  annualRevenueGrowthSeries,
  displayEps,
  displayRevenueUsd,
  isAnnualForecastPoint,
  sliceLatestAnnualEstimates,
  sliceLatestQuarterlyEstimates,
} from "@/lib/market/earnings-annual-display";
import type {
  IncomeStatementTableModel,
  IncomeStatementRowModel,
} from "@/lib/market/stock-financials-income-table";
import type { StockEarningsEstimatesPoint } from "@/lib/market/stock-earnings-types";

/** Same four-row annual summary as the legacy table, using Financials table chrome. */
export function buildEarningsAnnualSummaryTableModel(
  annual: StockEarningsEstimatesPoint[],
): IncomeStatementTableModel | null {
  const cols = sliceLatestAnnualEstimates(annual);
  if (cols.length === 0) return null;

  const columns = cols.map((p) => p.label);
  const columnIsForecast = cols.map((p) => isAnnualForecastPoint(p));
  const columnPeriodEnds = cols.map((p) =>
    /^\d{4}-\d{2}-\d{2}$/.test(p.sortKey)
      ? formatFinancialsPeriodEndDisplay(p.sortKey)
      : "—",
  );

  const revenueVals = cols.map(displayRevenueUsd);
  const revGrowth = annualRevenueGrowthSeries(cols);
  const epsVals = cols.map(displayEps);
  const epsGrowth = annualEpsGrowthSeries(cols);

  const rows: IncomeStatementRowModel[] = [
    {
      id: "revenue",
      label: "Revenue",
      emphasize: true,
      format: "usd",
      values: revenueVals,
      chartingMetricId: "revenue",
    },
    {
      id: "revenue_growth",
      label: "Revenue growth",
      emphasize: false,
      format: "pctGrowth",
      values: revGrowth,
    },
    {
      id: "eps",
      label: "EPS",
      emphasize: true,
      format: "perShare",
      values: epsVals,
      chartingMetricId: "eps",
    },
    {
      id: "eps_growth",
      label: "EPS growth",
      emphasize: false,
      format: "pctGrowth",
      values: epsGrowth,
    },
  ];

  return {
    periodColumnHeader: "Fiscal Year",
    columns,
    columnPeriodEnds,
    columnIsForecast,
    rows,
  };
}

/** Quarterly revenue / EPS summary — same slice + rows as the Estimates quarterly chart. */
export function buildEarningsQuarterlySummaryTableModel(
  quarterly: StockEarningsEstimatesPoint[],
): IncomeStatementTableModel | null {
  const cols = sliceLatestQuarterlyEstimates(quarterly);
  if (cols.length === 0) return null;

  const columns = cols.map((p) =>
    /^\d{4}-\d{2}-\d{2}$/.test(p.sortKey)
      ? formatChartingPeriodAxisLabel(p.sortKey, "quarterly")
      : p.label,
  );
  const columnIsForecast = cols.map((p) => isAnnualForecastPoint(p));
  const columnPeriodEnds = cols.map((p) =>
    /^\d{4}-\d{2}-\d{2}$/.test(p.sortKey)
      ? formatFinancialsPeriodEndDisplay(p.sortKey)
      : "—",
  );

  const revenueVals = cols.map(displayRevenueUsd);
  const revGrowth = annualRevenueGrowthSeries(cols);
  const epsVals = cols.map(displayEps);
  const epsGrowth = annualEpsGrowthSeries(cols);

  const rows: IncomeStatementRowModel[] = [
    {
      id: "revenue",
      label: "Revenue",
      emphasize: true,
      format: "usd",
      values: revenueVals,
      chartingMetricId: "revenue",
    },
    {
      id: "revenue_growth",
      label: "Revenue growth",
      emphasize: false,
      format: "pctGrowth",
      values: revGrowth,
    },
    {
      id: "eps",
      label: "EPS",
      emphasize: true,
      format: "perShare",
      values: epsVals,
      chartingMetricId: "eps",
    },
    {
      id: "eps_growth",
      label: "EPS growth",
      emphasize: false,
      format: "pctGrowth",
      values: epsGrowth,
    },
  ];

  return {
    periodColumnHeader: "Fiscal Quarter",
    columns,
    columnPeriodEnds,
    columnIsForecast,
    rows,
  };
}
