import type { ChartingSeriesPoint } from "@/lib/market/charting-series-types";

export const CHARTING_METRIC_IDS = [
  "revenue",
  "gross_profit",
  "operating_income",
  "net_income",
  "ebitda",
  "eps",
  "free_cash_flow",
  "total_assets",
  "cash_on_hand",
  "long_term_debt",
  "total_liabilities",
  "shareholder_equity",
  "debt_to_equity",
  "shares_outstanding",
  "gross_margin",
  "operating_margin",
  "ebitda_margin",
  "net_margin",
  "pre_tax_margin",
  "fcf_margin",
  "revenue_yoy",
  "revenue_3y_cagr",
  "eps_yoy",
  "eps_3y_cagr",
  "return_on_equity",
  "return_on_assets",
  "return_on_capital_employed",
  "return_on_investment",
  "pe_ratio",
  "trailing_pe",
  "forward_pe",
  "ps_ratio",
  "price_book",
  "ev_ebitda",
  "ev_sales",
  "cash_debt",
  "dividend_yield",
  "payout_ratio",
] as const;

export type ChartingMetricId = (typeof CHARTING_METRIC_IDS)[number];

export type ChartingMetricKind = "usd" | "eps" | "shares" | "percent" | "multiple" | "ratio";

/** Maps each metric to its field on `ChartingSeriesPoint`. */
export const CHARTING_METRIC_FIELD: Record<ChartingMetricId, keyof ChartingSeriesPoint> = {
  revenue: "revenue",
  gross_profit: "grossProfit",
  operating_income: "operatingIncome",
  net_income: "netIncome",
  ebitda: "ebitda",
  eps: "eps",
  free_cash_flow: "freeCashFlow",
  total_assets: "totalAssets",
  cash_on_hand: "cashOnHand",
  long_term_debt: "longTermDebt",
  total_liabilities: "totalLiabilities",
  shareholder_equity: "shareholderEquity",
  debt_to_equity: "debtToEquity",
  shares_outstanding: "sharesOutstanding",
  gross_margin: "grossMargin",
  operating_margin: "operatingMargin",
  ebitda_margin: "ebitdaMargin",
  net_margin: "netMargin",
  pre_tax_margin: "preTaxMargin",
  fcf_margin: "fcfMargin",
  revenue_yoy: "revenueYoy",
  revenue_3y_cagr: "revenue3yCagr",
  eps_yoy: "epsYoy",
  eps_3y_cagr: "eps3yCagr",
  return_on_equity: "returnOnEquity",
  return_on_assets: "returnOnAssets",
  return_on_capital_employed: "returnOnCapitalEmployed",
  return_on_investment: "returnOnInvestment",
  pe_ratio: "peRatio",
  trailing_pe: "trailingPe",
  forward_pe: "forwardPe",
  ps_ratio: "psRatio",
  price_book: "priceBook",
  ev_ebitda: "evEbitda",
  ev_sales: "evSales",
  cash_debt: "cashDebt",
  dividend_yield: "dividendYield",
  payout_ratio: "payoutRatio",
};

export const CHARTING_METRIC_LABEL: Record<ChartingMetricId, string> = {
  revenue: "Revenue",
  gross_profit: "Gross Profit",
  operating_income: "Operating Income",
  net_income: "Net Income",
  ebitda: "EBITDA",
  eps: "EPS",
  free_cash_flow: "Free Cash Flow",
  total_assets: "Total Assets",
  cash_on_hand: "Cash on Hand",
  long_term_debt: "Long Term Debt",
  total_liabilities: "Total Liabilities",
  shareholder_equity: "Shareholder Equity",
  debt_to_equity: "Debt/Equity",
  shares_outstanding: "Shares Outstanding",
  gross_margin: "Gross Margin",
  operating_margin: "Operating Margin",
  ebitda_margin: "EBITDA Margin",
  net_margin: "Net Margin",
  pre_tax_margin: "Pre-Tax Margin",
  fcf_margin: "Free Cash Flow Margin",
  revenue_yoy: "Quarterly Revenue (YoY)",
  revenue_3y_cagr: "Revenue (3Y)",
  eps_yoy: "Quarterly EPS (YoY)",
  eps_3y_cagr: "EPS (3Y)",
  return_on_equity: "Return on Equity (ROE)",
  return_on_assets: "Return on Assets (ROA)",
  return_on_capital_employed: "Return on Capital Employed (ROCE)",
  return_on_investment: "Return on Investments (ROI)",
  pe_ratio: "P/E Ratio",
  trailing_pe: "Trailing P/E",
  forward_pe: "Forward P/E",
  ps_ratio: "P/S Ratio",
  price_book: "Price/Book",
  ev_ebitda: "EV/EBITDA",
  ev_sales: "EV/Sales",
  cash_debt: "Cash/Debt",
  dividend_yield: "Dividend Yield",
  payout_ratio: "Payout Ratio",
};

export const CHARTING_METRIC_KIND: Record<ChartingMetricId, ChartingMetricKind> = {
  revenue: "usd",
  gross_profit: "usd",
  operating_income: "usd",
  net_income: "usd",
  ebitda: "usd",
  eps: "eps",
  free_cash_flow: "usd",
  total_assets: "usd",
  cash_on_hand: "usd",
  long_term_debt: "usd",
  total_liabilities: "usd",
  shareholder_equity: "usd",
  debt_to_equity: "ratio",
  shares_outstanding: "shares",
  gross_margin: "percent",
  operating_margin: "percent",
  ebitda_margin: "percent",
  net_margin: "percent",
  pre_tax_margin: "percent",
  fcf_margin: "percent",
  revenue_yoy: "percent",
  revenue_3y_cagr: "percent",
  eps_yoy: "percent",
  eps_3y_cagr: "percent",
  return_on_equity: "percent",
  return_on_assets: "percent",
  return_on_capital_employed: "percent",
  return_on_investment: "percent",
  pe_ratio: "multiple",
  trailing_pe: "multiple",
  forward_pe: "multiple",
  ps_ratio: "multiple",
  price_book: "multiple",
  ev_ebitda: "multiple",
  ev_sales: "multiple",
  cash_debt: "multiple",
  dividend_yield: "percent",
  payout_ratio: "percent",
};

export type ChartingDropdownGroupId = "financials" | "margins" | "growth" | "returns" | "valuation" | "dividends";

export const CHARTING_DROPDOWN_GROUPS: { id: ChartingDropdownGroupId; label: string; metricIds: ChartingMetricId[] }[] =
  [
    {
      id: "financials",
      label: "Financials",
      metricIds: [
        "revenue",
        "gross_profit",
        "operating_income",
        "net_income",
        "ebitda",
        "eps",
        "free_cash_flow",
        "total_assets",
        "cash_on_hand",
        "long_term_debt",
        "total_liabilities",
        "shareholder_equity",
        "debt_to_equity",
        "shares_outstanding",
      ],
    },
    {
      id: "margins",
      label: "Margins",
      metricIds: [
        "gross_margin",
        "operating_margin",
        "ebitda_margin",
        "net_margin",
        "pre_tax_margin",
        "fcf_margin",
      ],
    },
    {
      id: "growth",
      label: "Growth",
      metricIds: ["revenue_yoy", "revenue_3y_cagr", "eps_yoy", "eps_3y_cagr"],
    },
    {
      id: "returns",
      label: "Returns",
      metricIds: [
        "return_on_equity",
        "return_on_assets",
        "return_on_capital_employed",
        "return_on_investment",
      ],
    },
    {
      id: "valuation",
      label: "Valuation",
      metricIds: [
        "pe_ratio",
        "trailing_pe",
        "forward_pe",
        "ps_ratio",
        "price_book",
        "ev_ebitda",
        "ev_sales",
        "cash_debt",
      ],
    },
    {
      id: "dividends",
      label: "Dividends",
      metricIds: ["dividend_yield", "payout_ratio"],
    },
  ];

export function isChartingMetricId(s: string | null | undefined): s is ChartingMetricId {
  return s != null && (CHARTING_METRIC_IDS as readonly string[]).includes(s);
}

/** URL query value (underscore) */
export function chartingMetricToParam(id: ChartingMetricId): string {
  return id;
}

export function parseChartingMetricParam(s: string | null): ChartingMetricId | null {
  if (!s) return null;
  const v = s
    .trim()
    .toLowerCase()
    .replace(/-/g, "_")
    .replace(/\s+/g, "_");
  return isChartingMetricId(v) ? v : null;
}

/** Default metrics when opening Charting (standalone or stock tab). */
export const CHARTING_DEFAULT_METRICS: ChartingMetricId[] = ["revenue", "net_income"];

/**
 * Parse `metric=revenue,net_income` or a single id from the charting URL.
 */
export function parseChartingMetricsParam(s: string | null | undefined): ChartingMetricId[] {
  if (!s?.trim()) return [];
  const parts = s
    .split(/[,]+/)
    .map((p) => p.trim())
    .filter(Boolean);
  const out: ChartingMetricId[] = [];
  const seen = new Set<ChartingMetricId>();
  for (const p of parts) {
    const m = parseChartingMetricParam(p);
    if (m && !seen.has(m)) {
      seen.add(m);
      out.push(m);
    }
  }
  return out;
}

export function chartingMetricsToParam(ids: ChartingMetricId[]): string {
  return ids.map(chartingMetricToParam).join(",");
}

/** Max symbols compared on `/charting` (comma-separated `ticker=`). */
export const CHARTING_MAX_COMPARE_TICKERS = 8;

/**
 * Parse `ticker=AAPL,MSFT` — dedupe, preserve order, uppercase.
 */
export function parseChartingTickerList(raw: string | null | undefined): string[] {
  if (!raw?.trim()) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of raw.split(",")) {
    const t = part.trim().toUpperCase();
    if (!t || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out.slice(0, CHARTING_MAX_COMPARE_TICKERS);
}

export function chartingTickersToParam(tickers: string[]): string {
  return tickers.join(",");
}

/** `/charting` URL with optional `ticker` and `metric` query (omits empty parts). */
export function buildChartingPath(tickers: string[], metricIds: ChartingMetricId[]): string {
  const tq = chartingTickersToParam(tickers);
  const mq = chartingMetricsToParam(metricIds);
  if (!tq && !mq) return "/charting";
  const p = new URLSearchParams();
  if (tq) p.set("ticker", tq);
  if (mq) p.set("metric", mq);
  return `/charting?${p.toString()}`;
}

/** True when standalone Charting should load data and show the chart (not the blank hero). */
export function isChartingSessionReady(tickers: string[], metricParam: string | null | undefined): boolean {
  return tickers.length > 0 && parseChartingMetricsParam(metricParam).length > 0;
}
