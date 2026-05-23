import type { StockKeyStatsBundle } from "@/lib/market/stock-key-stats-bundle-types";

export type ScreenerKeyStatSection = keyof StockKeyStatsBundle;

export type ScreenerKeyStatMetricDef = {
  id: string;
  label: string;
  section: ScreenerKeyStatSection;
};

export type ScreenerKeyStatCategoryDef = {
  id: string;
  title: string;
  metrics: ScreenerKeyStatMetricDef[];
};

function m(id: string, label: string, section: ScreenerKeyStatSection): ScreenerKeyStatMetricDef {
  return { id, label, section };
}

/** Same measure as the Companies table’s built-in “M Cap” column — Customize treats it as always on at default. */
export const SCREENER_BUILTIN_MARKET_CAP_METRIC_ID = "basic-market-cap";

/** Same display source as the Companies “PE” column (`peRatioKeyStatsDisplayFromFundamentalsRoot` = Key Stats “P/E Ratio”). */
export const SCREENER_BUILTIN_PE_METRIC_ID = "val-pe-ratio";

export function isScreenerBuiltinTableMetricId(id: string): boolean {
  return id === SCREENER_BUILTIN_MARKET_CAP_METRIC_ID || id === SCREENER_BUILTIN_PE_METRIC_ID;
}

const BASIC_METRICS: ScreenerKeyStatMetricDef[] = [
  m(SCREENER_BUILTIN_MARKET_CAP_METRIC_ID, "Market Cap", "basic"),
  m("basic-enterprise-value", "Enterprise Value", "basic"),
  m("basic-shares-outstanding", "Shares Outstanding", "basic"),
  m("basic-1y-target", "1Y Target Est", "basic"),
  m("basic-analyst-consensus", "Analyst Consensus", "basic"),
  m("basic-earnings-date", "Earnings Date", "basic"),
  m("basic-employees", "Employees", "basic"),
];

const VALUATION_METRICS: ScreenerKeyStatMetricDef[] = [
  m(SCREENER_BUILTIN_PE_METRIC_ID, "P/E Ratio", "valuation"),
  m("val-trailing-pe", "Trailing P/E", "valuation"),
  m("val-forward-pe", "Forward P/E", "valuation"),
  m("val-ps", "P/S Ratio", "valuation"),
  m("val-price-book", "Price/Book Ratio", "valuation"),
  m("val-price-fcf", "Price/FCF Ratio", "valuation"),
  m("val-ev-ebitda", "EV/EBITDA", "valuation"),
  m("val-ev-sales", "EV/Sales", "valuation"),
  m("val-cash-debt", "Cash/Debt", "valuation"),
];

const REVENUE_PROFIT_METRICS: ScreenerKeyStatMetricDef[] = [
  m("rp-revenue", "Revenue", "revenueProfit"),
  m("rp-gross-profit", "Gross Profit", "revenueProfit"),
  m("rp-operating-income", "Operating Income", "revenueProfit"),
  m("rp-net-income", "Net Income", "revenueProfit"),
  m("rp-ebitda", "EBITDA", "revenueProfit"),
  m("rp-eps", "EPS", "revenueProfit"),
  m("rp-fcf", "FCF", "revenueProfit"),
];

const MARGINS_METRICS: ScreenerKeyStatMetricDef[] = [
  m("mg-gross", "Gross Margin", "margins"),
  m("mg-operating", "Operating Margin", "margins"),
  m("mg-ebitda", "EBITDA Margin", "margins"),
  m("mg-pre-tax", "Pre-Tax Margin", "margins"),
  m("mg-net", "Net Margin", "margins"),
  m("mg-fcf", "Free Cash Flow", "margins"),
];

const GROWTH_METRICS: ScreenerKeyStatMetricDef[] = [
  m("gr-q-rev-yoy", "Quarterly Revenue (YoY)", "growth"),
  m("gr-rev-3y", "Revenue (3Y)", "growth"),
  m("gr-q-eps-yoy", "Quarterly EPS (YoY)", "growth"),
  m("gr-eps-3y", "EPS (3Y)", "growth"),
];

const ASSETS_METRICS: ScreenerKeyStatMetricDef[] = [
  m("al-total-assets", "Total Assets", "assetsLiabilities"),
  m("al-cash", "Cash on Hand", "assetsLiabilities"),
  m("al-ltd", "Long Term Debt", "assetsLiabilities"),
  m("al-total-liab", "Total Liabilities", "assetsLiabilities"),
  m("al-equity", "Share Holder Equity", "assetsLiabilities"),
  m("al-debt-equity", "Debt/Equity", "assetsLiabilities"),
];

const RETURNS_METRICS: ScreenerKeyStatMetricDef[] = [
  m("ret-roe", "Return on Equity (ROE)", "returns"),
  m("ret-roa", "Return on Assets (ROA)", "returns"),
  m("ret-roce", "Return on Capital Employed (ROCE)", "returns"),
  m("ret-roi", "Return on Investments (ROI)", "returns"),
];

const DIVIDENDS_METRICS: ScreenerKeyStatMetricDef[] = [
  m("div-yield", "Yield", "dividends"),
  m("div-payout", "Payout", "dividends"),
];

const RISK_METRICS: ScreenerKeyStatMetricDef[] = [
  m("risk-beta-5y", "Beta (5Y)", "risk"),
  m("risk-max-dd", "Max Drawdown (5Y)", "risk"),
];

export const SCREENER_KEY_STAT_CATEGORIES: ScreenerKeyStatCategoryDef[] = [
  { id: "basic", title: "Basic", metrics: BASIC_METRICS },
  { id: "valuation", title: "Valuation", metrics: VALUATION_METRICS },
  { id: "revenue-profit", title: "Revenue & Profit", metrics: REVENUE_PROFIT_METRICS },
  { id: "margins", title: "Margins", metrics: MARGINS_METRICS },
  { id: "growth", title: "Growth", metrics: GROWTH_METRICS },
  { id: "assets", title: "Assets & Liabilities", metrics: ASSETS_METRICS },
  { id: "returns", title: "Returns", metrics: RETURNS_METRICS },
  { id: "dividends", title: "Dividends", metrics: DIVIDENDS_METRICS },
  { id: "risk", title: "Risk", metrics: RISK_METRICS },
];

export const SCREENER_KEY_STAT_METRICS_BY_ID: Record<string, ScreenerKeyStatMetricDef> =
  SCREENER_KEY_STAT_CATEGORIES.reduce<Record<string, ScreenerKeyStatMetricDef>>((acc, cat) => {
    for (const metric of cat.metrics) {
      acc[metric.id] = metric;
    }
    return acc;
  }, {});

export function getScreenerKeyStatMetricById(id: string): ScreenerKeyStatMetricDef | undefined {
  return SCREENER_KEY_STAT_METRICS_BY_ID[id];
}
