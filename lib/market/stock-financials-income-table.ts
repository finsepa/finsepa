import type { ChartingSeriesPoint } from "@/lib/market/charting-series-types";
import { annualFundamentalsSlice, pctChange } from "@/lib/market/stock-financials-annual-slice";

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
};

export type IncomeStatementTableModel = {
  /** Calendar / fiscal year labels (e.g. `2019` … `2026`), left → right oldest → newest. */
  columns: string[];
  rows: IncomeStatementRowModel[];
};

/**
 * Builds a wide annual Income table from merged fundamentals points (same shape as charting annual series).
 * Omits line items we cannot derive from {@link ChartingSeriesPoint} yet (e.g. separate SG&A / tax lines).
 */
export function buildIncomeStatementTableModel(points: ChartingSeriesPoint[]): IncomeStatementTableModel | null {
  const sliced = annualFundamentalsSlice(points);
  if (!sliced) return null;
  const { columns, slice } = sliced;

  const pick = (fn: (p: ChartingSeriesPoint) => number | null): (number | null)[] => slice.map(fn);

  const revenue = pick((p) => p.revenue);
  const grossProfit = pick((p) => p.grossProfit);
  const operatingIncome = pick((p) => p.operatingIncome);
  const pretax = pick((p) => p.incomeBeforeTax);
  const netIncome = pick((p) => p.netIncome);
  const eps = pick((p) => p.eps);
  const fcf = pick((p) => p.freeCashFlow);
  const shares = pick((p) => p.sharesOutstanding);
  const ebitda = pick((p) => p.ebitda);

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

  const grossMarginPct = pick((p) => (p.grossMargin != null ? p.grossMargin * 100 : null));
  const operatingMarginPct = pick((p) => (p.operatingMargin != null ? p.operatingMargin * 100 : null));
  const netMarginPct = pick((p) => (p.netMargin != null ? p.netMargin * 100 : null));
  const fcfMarginPct = pick((p) => (p.fcfMargin != null ? p.fcfMargin * 100 : null));
  const ebitdaMarginPct = pick((p) => (p.ebitdaMargin != null ? p.ebitdaMargin * 100 : null));

  const rows: IncomeStatementRowModel[] = [
    { id: "revenue", label: "Revenue", emphasize: true, format: "usd", values: revenue },
    { id: "revenue_growth", label: "Revenue Growth (YoY)", emphasize: false, format: "pctGrowth", values: revenueGrowth },
    { id: "cost_of_revenue", label: "Cost of revenue", emphasize: false, format: "usd", values: costOfRevenue },
    { id: "gross_profit", label: "Gross Profit", emphasize: true, format: "usd", values: grossProfit },
    { id: "operating_income", label: "Operating Income", emphasize: true, format: "usd", values: operatingIncome },
    { id: "pretax_income", label: "Pretax Income", emphasize: true, format: "usd", values: pretax },
    { id: "net_income", label: "Net Income", emphasize: true, format: "usd", values: netIncome },
    {
      id: "net_income_growth",
      label: "Net Income Growth",
      emphasize: false,
      format: "pctGrowth",
      values: netIncomeGrowthResolved,
    },
    { id: "shares_out", label: "Shares Outstanding (Diluted)", emphasize: true, format: "shares", values: shares },
    { id: "shares_change", label: "Shares Change", emphasize: false, format: "pctGrowth", values: sharesChange },
    { id: "eps", label: "EPS (Diluted)", emphasize: true, format: "perShare", values: eps },
    { id: "eps_growth", label: "EPS Growth", emphasize: false, format: "pctGrowth", values: epsGrowth },
    { id: "fcf", label: "Free Cash Flow", emphasize: true, format: "usd", values: fcf },
    { id: "fcf_ps", label: "Free Cash Flow Per Share", emphasize: false, format: "perShare", values: fcfPerShare },
    { id: "gross_margin", label: "Gross Margin", emphasize: false, format: "pctMargin", values: grossMarginPct },
    { id: "operating_margin", label: "Operating Margin", emphasize: false, format: "pctMargin", values: operatingMarginPct },
    { id: "profit_margin", label: "Profit Margin", emphasize: false, format: "pctMargin", values: netMarginPct },
    { id: "fcf_margin", label: "Free Cash Flow Margin", emphasize: false, format: "pctMargin", values: fcfMarginPct },
    { id: "ebitda", label: "EBITDA", emphasize: true, format: "usd", values: ebitda },
    { id: "ebitda_margin", label: "EBITDA Margin", emphasize: false, format: "pctMargin", values: ebitdaMarginPct },
    { id: "ebit", label: "EBIT", emphasize: true, format: "usd", values: operatingIncome },
    { id: "ebit_margin", label: "EBIT Margin", emphasize: false, format: "pctMargin", values: operatingMarginPct },
  ];

  const anyNumber = rows.some((r) => r.values.some((v) => v != null && Number.isFinite(v)));
  if (!anyNumber) return null;

  return { columns, rows };
}
