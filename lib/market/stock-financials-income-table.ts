import type { ChartingSeriesPoint, FundamentalsSeriesMode } from "@/lib/market/charting-series-types";
import type { ChartingMetricId } from "@/lib/market/stock-charting-metrics";
import {
  annualFundamentalsSlice,
  financialsRowHasNumericValues,
  pctChange,
} from "@/lib/market/stock-financials-annual-slice";
import { attachFinancialsRowCharts } from "@/lib/market/stock-financials-row-chart";
import { attachTtmToFinancialsRows, ttmGrowthVsPriorYear } from "@/lib/market/stock-financials-ttm";

/** How each numeric cell should render in Financials statement tables. */
export type IncomeStatementValueFormat =
  | "usd"
  | "pctGrowth"
  | "pctMargin"
  | "perShare"
  | "shares"
  /** Valuation-style multiple (P/E, EV/EBITDA, …) — up to 2 fraction digits, no unit suffix. */
  | "ratio";

export type IncomeStatementRowModel = {
  id: string;
  label: string;
  emphasize: boolean;
  format: IncomeStatementValueFormat;
  values: (number | null)[];
  /** When set, Financials label opens the same fundamentals chart modal as Overview Key Stats. */
  chartingMetricId?: ChartingMetricId;
};

export type IncomeStatementTableModel = {
  /** First header cell (e.g. `Fiscal Year` or `Fiscal Quarter`). */
  periodColumnHeader?: string;
  /** Calendar / fiscal year labels (e.g. `2019` … `2026`), left → right oldest → newest. */
  columns: string[];
  /** Period-ending labels aligned with `columns` (e.g. `Dec 31, 2021`). */
  columnPeriodEnds: string[];
  /** When set, aligned with `columns` — true = consensus forecast (Earnings tab annual summary). */
  columnIsForecast?: boolean[];
  rows: IncomeStatementRowModel[];
  /** Optional trailing TTM column (stays at the trailing edge when columns are reversed). */
  ttm?: {
    columnLabel: string;
    periodEnd: string;
  };
};

/** Flip year columns and row values (e.g. `2018…2025` ↔ `2025…2018`). */
export function reverseIncomeStatementTableColumns(
  model: IncomeStatementTableModel,
): IncomeStatementTableModel {
  const order = model.columns.map((_, i) => i).reverse();
  const hasTtm = model.ttm != null;
  const ttmValueIndex = hasTtm ? model.rows[0]?.values.length - 1 : -1;

  return {
    columns: order.map((i) => model.columns[i]!),
    columnPeriodEnds: order.map((i) => model.columnPeriodEnds[i] ?? "—"),
    columnIsForecast: model.columnIsForecast?.length
      ? order.map((i) => model.columnIsForecast![i] ?? false)
      : undefined,
    ttm: model.ttm,
    rows: model.rows.map((row) => {
      const annualValues = order.map((i) => row.values[i] ?? null);
      const ttmValue = hasTtm && ttmValueIndex >= 0 ? (row.values[ttmValueIndex] ?? null) : null;
      return {
        ...row,
        values: hasTtm ? [...annualValues, ttmValue] : annualValues,
      };
    }),
  };
}

function incomeStatementTtmValue(
  rowId: string,
  ttm: ChartingSeriesPoint,
  priorAnnual: ChartingSeriesPoint | null,
): number | null {
  switch (rowId) {
    case "revenue":
      return ttm.revenue;
    case "revenue_growth":
      return ttmGrowthVsPriorYear(ttm, priorAnnual, (p) => p.revenue, ttm.revenueYoy);
    case "cost_of_revenue":
      return ttm.revenue != null && ttm.grossProfit != null ? ttm.revenue - ttm.grossProfit : null;
    case "gross_profit":
      return ttm.grossProfit;
    case "sga":
      return ttm.sga;
    case "research_development":
      return ttm.researchAndDevelopment;
    case "other_operating_expense":
      return ttm.otherOperatingExpense;
    case "total_operating_expenses":
      return ttm.totalOperatingExpenses;
    case "operating_income":
      return ttm.operatingIncome;
    case "pretax_income":
      return ttm.incomeBeforeTax;
    case "net_income":
      return ttm.netIncome;
    case "net_income_growth":
      return ttmGrowthVsPriorYear(ttm, priorAnnual, (p) => p.netIncome, null);
    case "shares_out":
      return ttm.sharesOutstanding;
    case "shares_change":
      return priorAnnual ? pctChange(ttm.sharesOutstanding, priorAnnual.sharesOutstanding) : null;
    case "eps_basic":
      return ttm.epsBasic;
    case "eps":
      return ttm.eps;
    case "eps_growth":
      return ttmGrowthVsPriorYear(ttm, priorAnnual, (p) => p.eps, ttm.epsYoy);
    case "fcf":
      return ttm.freeCashFlow;
    case "fcf_ps":
      if (ttm.freeCashFlow == null || ttm.sharesOutstanding == null) return null;
      const sh = ttm.sharesOutstanding;
      return Number.isFinite(sh) && Math.abs(sh) >= 1e-9 ? ttm.freeCashFlow / sh : null;
    case "gross_margin":
      return ttm.grossMargin != null ? ttm.grossMargin * 100 : null;
    case "operating_margin":
      return ttm.operatingMargin != null ? ttm.operatingMargin * 100 : null;
    case "profit_margin":
      return ttm.netMargin != null ? ttm.netMargin * 100 : null;
    case "fcf_margin":
      return ttm.fcfMargin != null ? ttm.fcfMargin * 100 : null;
    case "dividends_ps":
      return ttm.dividendsPerShare;
    case "dividend_growth": {
      const priorDps = priorAnnual?.dividendsPerShare ?? null;
      if (priorDps == null || !Number.isFinite(priorDps) || Math.abs(priorDps) < 1e-9) return null;
      return ttmGrowthVsPriorYear(ttm, priorAnnual, (p) => p.dividendsPerShare, ttm.dividendsPerShareYoy);
    }
    case "ebitda":
      return ttm.ebitda;
    case "ebitda_margin":
      return ttm.ebitdaMargin != null ? ttm.ebitdaMargin * 100 : null;
    case "ebit":
      return ttm.ebit ?? ttm.operatingIncome;
    case "ebit_margin": {
      if (ttm.revenue == null || ttm.revenue === 0) return null;
      const e = ttm.ebit ?? ttm.operatingIncome;
      if (e != null && Number.isFinite(e)) return (e / ttm.revenue) * 100;
      return ttm.operatingMargin != null ? ttm.operatingMargin * 100 : null;
    }
    case "effective_tax_rate":
      return ttm.effectiveTaxRate != null ? ttm.effectiveTaxRate * 100 : null;
    default:
      return null;
  }
}

/**
 * Builds a wide annual Income table from merged fundamentals points (same shape as charting annual series).
 */
export function buildIncomeStatementTableModel(
  points: ChartingSeriesPoint[],
  ttmPoint?: ChartingSeriesPoint | null,
  periodMode: FundamentalsSeriesMode = "annual",
): IncomeStatementTableModel | null {
  const sliced = annualFundamentalsSlice(points, periodMode);
  if (!sliced) return null;
  const { columns, columnPeriodEnds, slice } = sliced;

  const pick = (fn: (p: ChartingSeriesPoint) => number | null): (number | null)[] => slice.map(fn);

  const revenue = pick((p) => p.revenue);
  const grossProfit = pick((p) => p.grossProfit);
  const sga = pick((p) => p.sga);
  const researchAndDevelopment = pick((p) => p.researchAndDevelopment);
  const otherOperatingExpense = pick((p) => p.otherOperatingExpense);
  const totalOperatingExpenses = pick((p) => p.totalOperatingExpenses);
  const operatingIncome = pick((p) => p.operatingIncome);
  const pretax = pick((p) => p.incomeBeforeTax);
  const netIncome = pick((p) => p.netIncome);
  const epsBasic = pick((p) => p.epsBasic);
  const eps = pick((p) => p.eps);
  const fcf = pick((p) => p.freeCashFlow);
  const shares = pick((p) => p.sharesOutstanding);
  const ebitda = pick((p) => p.ebitda);
  const ebit = pick((p) => p.ebit ?? p.operatingIncome);

  const revenueGrowth: (number | null)[] = slice.map((p, i) => {
    if (p.revenueYoy != null && Number.isFinite(p.revenueYoy)) return p.revenueYoy * 100;
    if (i === 0) return null;
    return pctChange(p.revenue, slice[i - 1]!.revenue);
  });

  const costOfRevenue = slice.map((p) => {
    if (p.revenue == null || p.grossProfit == null) return null;
    return p.revenue - p.grossProfit;
  });

  const netIncomeGrowthResolved = slice.map((p, i) => {
    if (i === 0) return null;
    return pctChange(p.netIncome, slice[i - 1]!.netIncome);
  });

  const sharesChange = slice.map((p, i) => {
    if (i === 0) return null;
    return pctChange(p.sharesOutstanding, slice[i - 1]!.sharesOutstanding);
  });

  const epsGrowth = slice.map((p, i) => {
    if (p.epsYoy != null && Number.isFinite(p.epsYoy)) return p.epsYoy * 100;
    if (i === 0) return null;
    return pctChange(p.eps, slice[i - 1]!.eps);
  });

  const fcfPerShare = slice.map((p) => {
    if (p.freeCashFlow == null || p.sharesOutstanding == null) return null;
    const sh = p.sharesOutstanding;
    if (!Number.isFinite(sh) || Math.abs(sh) < 1e-9) return null;
    return p.freeCashFlow / sh;
  });

  const dividendsPerShare = pick((p) => p.dividendsPerShare);

  const dividendGrowth = slice.map((p, i) => {
    if (p.dividendsPerShareYoy != null && Number.isFinite(p.dividendsPerShareYoy)) {
      return p.dividendsPerShareYoy * 100;
    }
    if (i === 0) return null;
    const prev = slice[i - 1]!.dividendsPerShare;
    if (prev == null || !Number.isFinite(prev) || Math.abs(prev) < 1e-9) return null;
    return pctChange(p.dividendsPerShare, prev);
  });

  const grossMarginPct = pick((p) => (p.grossMargin != null ? p.grossMargin * 100 : null));
  const operatingMarginPct = pick((p) => (p.operatingMargin != null ? p.operatingMargin * 100 : null));
  const netMarginPct = pick((p) => (p.netMargin != null ? p.netMargin * 100 : null));
  const fcfMarginPct = pick((p) => (p.fcfMargin != null ? p.fcfMargin * 100 : null));
  const ebitdaMarginPct = pick((p) => (p.ebitdaMargin != null ? p.ebitdaMargin * 100 : null));
  const ebitMarginPct = slice.map((p) => {
    if (p.revenue == null || p.revenue === 0) return null;
    const e = p.ebit ?? p.operatingIncome;
    if (e == null || !Number.isFinite(e)) {
      return p.operatingMargin != null ? p.operatingMargin * 100 : null;
    }
    return (e / p.revenue) * 100;
  });
  const effectiveTaxRatePct = pick((p) => (p.effectiveTaxRate != null ? p.effectiveTaxRate * 100 : null));

  const rows: IncomeStatementRowModel[] = [
    { id: "revenue", label: "Revenue", emphasize: true, format: "usd", values: revenue, chartingMetricId: "revenue" },
    {
      id: "revenue_growth",
      label: "Revenue Growth (YoY)",
      emphasize: false,
      format: "pctGrowth",
      values: revenueGrowth,
      chartingMetricId: "revenue_yoy",
    },
    { id: "cost_of_revenue", label: "Cost of revenue", emphasize: false, format: "usd", values: costOfRevenue },
    {
      id: "gross_profit",
      label: "Gross Profit",
      emphasize: true,
      format: "usd",
      values: grossProfit,
      chartingMetricId: "gross_profit",
    },
    {
      id: "sga",
      label: "Selling, General & Admin",
      emphasize: false,
      format: "usd",
      values: sga,
    },
    {
      id: "research_development",
      label: "Research & Development",
      emphasize: false,
      format: "usd",
      values: researchAndDevelopment,
    },
    {
      id: "other_operating_expense",
      label: "Other Operating Expenses",
      emphasize: false,
      format: "usd",
      values: otherOperatingExpense,
    },
    {
      id: "total_operating_expenses",
      label: "Total Operating Expenses",
      emphasize: false,
      format: "usd",
      values: totalOperatingExpenses,
    },
    {
      id: "operating_income",
      label: "Operating Income",
      emphasize: true,
      format: "usd",
      values: operatingIncome,
      chartingMetricId: "operating_income",
    },
    { id: "pretax_income", label: "Pretax Income", emphasize: true, format: "usd", values: pretax },
    { id: "net_income", label: "Net Income", emphasize: true, format: "usd", values: netIncome, chartingMetricId: "net_income" },
    {
      id: "net_income_growth",
      label: "Net Income Growth",
      emphasize: false,
      format: "pctGrowth",
      values: netIncomeGrowthResolved,
    },
    {
      id: "shares_out",
      label: "Shares Outstanding (Diluted)",
      emphasize: true,
      format: "shares",
      values: shares,
      chartingMetricId: "shares_outstanding",
    },
    { id: "shares_change", label: "Shares Change", emphasize: false, format: "pctGrowth", values: sharesChange },
    { id: "eps_basic", label: "EPS (Basic)", emphasize: true, format: "perShare", values: epsBasic },
    { id: "eps", label: "EPS (Diluted)", emphasize: true, format: "perShare", values: eps, chartingMetricId: "eps" },
    {
      id: "eps_growth",
      label: "EPS Growth",
      emphasize: false,
      format: "pctGrowth",
      values: epsGrowth,
      chartingMetricId: "eps_yoy",
    },
    { id: "fcf", label: "Free Cash Flow", emphasize: true, format: "usd", values: fcf, chartingMetricId: "free_cash_flow" },
    { id: "fcf_ps", label: "Free Cash Flow Per Share", emphasize: false, format: "perShare", values: fcfPerShare },
    {
      id: "fcf_margin",
      label: "Free Cash Flow Margin",
      emphasize: false,
      format: "pctMargin",
      values: fcfMarginPct,
      chartingMetricId: "fcf_margin",
    },
    {
      id: "dividends_ps",
      label: "Dividends Per Share",
      emphasize: true,
      format: "perShare",
      values: dividendsPerShare,
    },
    {
      id: "dividend_growth",
      label: "Dividend Growth",
      emphasize: false,
      format: "pctGrowth",
      values: dividendGrowth,
    },
    {
      id: "gross_margin",
      label: "Gross Margin",
      emphasize: true,
      format: "pctMargin",
      values: grossMarginPct,
      chartingMetricId: "gross_margin",
    },
    {
      id: "operating_margin",
      label: "Operating Margin",
      emphasize: true,
      format: "pctMargin",
      values: operatingMarginPct,
      chartingMetricId: "operating_margin",
    },
    {
      id: "profit_margin",
      label: "Profit Margin",
      emphasize: true,
      format: "pctMargin",
      values: netMarginPct,
      chartingMetricId: "net_margin",
    },
    { id: "ebitda", label: "EBITDA", emphasize: true, format: "usd", values: ebitda, chartingMetricId: "ebitda" },
    {
      id: "ebitda_margin",
      label: "EBITDA Margin",
      emphasize: false,
      format: "pctMargin",
      values: ebitdaMarginPct,
      chartingMetricId: "ebitda_margin",
    },
    {
      id: "ebit",
      label: "EBIT",
      emphasize: true,
      format: "usd",
      values: ebit,
      chartingMetricId: "operating_income",
    },
    {
      id: "ebit_margin",
      label: "EBIT Margin",
      emphasize: false,
      format: "pctMargin",
      values: ebitMarginPct,
      chartingMetricId: "operating_margin",
    },
    {
      id: "effective_tax_rate",
      label: "Effective Tax Rate",
      emphasize: false,
      format: "pctMargin",
      values: effectiveTaxRatePct,
    },
  ];

  const visibleRows = rows.filter((r) => financialsRowHasNumericValues(r.values, r.format));
  if (!visibleRows.length) return null;

  const priorAnnual = slice[slice.length - 1] ?? null;
  const withTtm = attachTtmToFinancialsRows(
    { columns, columnPeriodEnds, rows: visibleRows },
    ttmPoint,
    priorAnnual,
    (row) => (ttmPoint ? incomeStatementTtmValue(row.id, ttmPoint, priorAnnual) : null),
  );
  return attachFinancialsRowCharts(withTtm);
}
