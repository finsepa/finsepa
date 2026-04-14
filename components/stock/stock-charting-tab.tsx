import type { ChartingSeriesPoint } from "@/lib/market/charting-series-types";
import type { StockKeyStatsBundle } from "@/lib/market/stock-key-stats-bundle-types";
import type { ChartingMetricId } from "@/lib/market/stock-charting-metrics";
import { ChartingWorkspace } from "@/components/charting/charting-workspace";

type Props = {
  ticker: string;
  metricParam: string | null;
  initialAnnualPoints?: ChartingSeriesPoint[];
  initialQuarterlyPoints?: ChartingSeriesPoint[];
  /** Used to filter the Metric dropdown to “what Key Stats has”. */
  initialKeyStatsBundle?: StockKeyStatsBundle | null;
};

const LABEL_TO_METRIC: Partial<Record<string, ChartingMetricId>> = {
  Revenue: "revenue",
  "Gross Profit": "gross_profit",
  "Operating Income": "operating_income",
  "Net Income": "net_income",
  EBITDA: "ebitda",
  EPS: "eps",
  "Free Cash Flow": "free_cash_flow",

  "Total Assets": "total_assets",
  "Cash on Hand": "cash_on_hand",
  "Long Term Debt": "long_term_debt",
  "Total Liabilities": "total_liabilities",
  "Share Holder Equity": "shareholder_equity",
  "Debt/Equity": "debt_to_equity",
  "Shares Outstanding": "shares_outstanding",

  "Gross Margin": "gross_margin",
  "Operating Margin": "operating_margin",
  "EBITDA Margin": "ebitda_margin",
  "Pre-Tax Margin": "pre_tax_margin",
  "Net Margin": "net_margin",
  // Note: Key Stats "Margins" section has a "Free Cash Flow" row that maps to charting metric `fcf_margin`.

  "Quarterly Revenue (YoY)": "revenue_yoy",
  "Revenue (3Y)": "revenue_3y_cagr",
  "Quarterly EPS (YoY)": "eps_yoy",
  "EPS (3Y)": "eps_3y_cagr",

  "Return on Equity (ROE)": "return_on_equity",
  "Return on Assets (ROA)": "return_on_assets",
  "Return on Capital Employed (ROCE)": "return_on_capital_employed",
  "Return on Investments (ROI)": "return_on_investment",

  "P/E Ratio": "pe_ratio",
  "Trailing P/E": "trailing_pe",
  "Forward P/E": "forward_pe",
  "P/S Ratio": "ps_ratio",
  "Price/Book Ratio": "price_book",
  "EV/EBITDA": "ev_ebitda",
  "EV/Sales": "ev_sales",
  "Cash/Debt": "cash_debt",

  Yield: "dividend_yield",
  Payout: "payout_ratio",
};

function buildAllowedMetricsFromKeyStats(bundle: StockKeyStatsBundle | null | undefined): ChartingMetricId[] | undefined {
  if (!bundle) return undefined;
  const out = new Set<ChartingMetricId>();
  const sections = [
    { id: "basic", rows: bundle.basic },
    { id: "valuation", rows: bundle.valuation },
    { id: "revenueProfit", rows: bundle.revenueProfit },
    { id: "margins", rows: bundle.margins },
    { id: "growth", rows: bundle.growth },
    { id: "assetsLiabilities", rows: bundle.assetsLiabilities },
    { id: "returns", rows: bundle.returns },
    { id: "dividends", rows: bundle.dividends },
    { id: "risk", rows: bundle.risk },
  ] as const;

  for (const { id: sectionId, rows } of sections) {
    if (!rows) continue;
    for (const r of rows) {
      const label = r.label?.trim();
      const value = r.value?.trim();
      if (!label || !value || value === "—") continue;
      const mid =
        sectionId === "margins" && label === "Free Cash Flow"
          ? ("fcf_margin" satisfies ChartingMetricId)
          : LABEL_TO_METRIC[label];
      if (mid) out.add(mid);
    }
  }
  return out.size ? [...out] : undefined;
}

export function StockChartingTab({
  ticker,
  metricParam,
  initialAnnualPoints,
  initialQuarterlyPoints,
  initialKeyStatsBundle,
}: Props) {
  return (
    <ChartingWorkspace
      ticker={ticker}
      metricParam={metricParam}
      initialAnnualPoints={initialAnnualPoints}
      initialQuarterlyPoints={initialQuarterlyPoints}
      allowedMetricIds={buildAllowedMetricsFromKeyStats(initialKeyStatsBundle)}
    />
  );
}
