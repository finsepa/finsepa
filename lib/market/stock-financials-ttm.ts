import type { ChartingSeriesPoint } from "@/lib/market/charting-series-types";
import { formatFinancialsPeriodEndDisplay } from "@/lib/market/charting-period-display";
import type { IncomeStatementRowModel, IncomeStatementTableModel } from "@/lib/market/stock-financials-income-table";
import {
  filterFinancialsTableEmptyRows,
  financialsRowHasNumericValues,
  pctChange,
} from "@/lib/market/stock-financials-annual-slice";

/** Ratios rows often store decimals (0.052 = 5.2%); some feeds use whole percent (5.2). */
export function yieldOrRatioToDisplayPercent(v: number | null): number | null {
  if (v == null || !Number.isFinite(v)) return null;
  if (Math.abs(v) <= 1) return v * 100;
  return v;
}

export function financialsTableTtmMeta(
  ttm: ChartingSeriesPoint,
): NonNullable<IncomeStatementTableModel["ttm"]> {
  return {
    columnLabel: "TTM",
    periodEnd: formatFinancialsPeriodEndDisplay(ttm.periodEnd),
  };
}

/** Append TTM as the trailing column when `ttmPoint` is present. */
export function withTtmColumnValues(
  annual: (number | null)[],
  ttmValue: number | null,
  ttmPoint: ChartingSeriesPoint | null | undefined,
): (number | null)[] {
  return ttmPoint ? [...annual, ttmValue] : annual;
}

/** YoY % for TTM column: provider YoY decimal, else vs latest annual period. */
export function ttmGrowthVsPriorYear(
  ttm: ChartingSeriesPoint,
  priorAnnual: ChartingSeriesPoint | null,
  getValue: (p: ChartingSeriesPoint) => number | null,
  yoyDecimal: number | null | undefined,
): number | null {
  if (yoyDecimal != null && Number.isFinite(yoyDecimal)) return yoyDecimal * 100;
  if (!priorAnnual) return null;
  return pctChange(getValue(ttm), getValue(priorAnnual));
}

export function attachTtmToFinancialsRows(
  model: IncomeStatementTableModel,
  ttmPoint: ChartingSeriesPoint | null | undefined,
  priorAnnual: ChartingSeriesPoint | null,
  valueForRow: (row: IncomeStatementRowModel) => number | null,
): IncomeStatementTableModel {
  if (!ttmPoint) return filterFinancialsTableEmptyRows(model);
  const rows = model.rows.map((row) => ({
    ...row,
    values: withTtmColumnValues(row.values, valueForRow(row), ttmPoint),
  }));
  const anyTtm = rows.some((r) => {
    const v = r.values[r.values.length - 1];
    return financialsRowHasNumericValues([v], r.format);
  });
  if (!anyTtm) return filterFinancialsTableEmptyRows(model);
  return filterFinancialsTableEmptyRows({
    ...model,
    ttm: financialsTableTtmMeta(ttmPoint),
    rows,
  });
}
