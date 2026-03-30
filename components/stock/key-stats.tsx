"use client";

import type { ChartingMetricId } from "@/lib/market/stock-charting-metrics";
import { KeyStatsBasicCard } from "./key-stats-basic-card";
import { KeyStatsDynamicCard } from "./key-stats-dynamic-card";
import { KeyStatsRevenueProfitCard } from "./key-stats-revenue-profit-card";

const ASSETS_LABELS = [
  "Total Assets",
  "Cash on Hand",
  "Long Term Debt",
  "Total Liabilities",
  "Share Holder Equity",
  "Debt/Equity",
];

const RETURNS_LABELS = [
  "Return on Equity (ROE)",
  "Return on Assets (ROA)",
  "Return on Capital Employed (ROCE)",
  "Return on Investments (ROI)",
];

const MARGINS_LABELS = [
  "Gross Margin",
  "Operating Margin",
  "EBITDA Margin",
  "Pre-Tax Margin",
  "Net Margin",
  "Free Cash Flow",
];

const GROWTH_LABELS = [
  "Quarterly Revenue (YoY)",
  "Revenue (3Y)",
  "Quarterly EPS (YoY)",
  "EPS (3Y)",
];

const VALUATION_LABELS = [
  "P/E Ratio",
  "Trailing P/E",
  "Forward P/E",
  "P/S Ratio",
  "Price/Book Ratio",
  "Price/FCF Ratio",
  "EV/EBITDA",
  "EV/Sales",
  "Cash/Debt",
];

const DIVIDENDS_LABELS = ["Yield", "Payout"];

const RISK_LABELS = ["Beta (5Y)", "Max Drawdown (5Y)"];

export function KeyStats({
  ticker,
  onRevenueProfitMetricClick,
}: {
  ticker: string;
  onRevenueProfitMetricClick?: (id: ChartingMetricId) => void;
}) {
  return (
    <div>
      <h2 className="text-[18px] font-semibold leading-7 text-[#09090B] mb-4">Key Stats</h2>
      <div className="grid grid-cols-3 gap-5">
        {/* Column 1 */}
        <div>
          <KeyStatsBasicCard ticker={ticker} />
          <KeyStatsDynamicCard
            ticker={ticker}
            title="Valuation"
            apiPath="key-stats-valuation"
            rowLabels={VALUATION_LABELS}
          />
        </div>

        {/* Column 2 */}
        <div>
          <KeyStatsRevenueProfitCard ticker={ticker} onMetricClick={onRevenueProfitMetricClick} />
          <KeyStatsDynamicCard
            ticker={ticker}
            title="Margins"
            apiPath="key-stats-margins"
            rowLabels={MARGINS_LABELS}
          />
          <KeyStatsDynamicCard
            ticker={ticker}
            title="Growth"
            apiPath="key-stats-growth"
            rowLabels={GROWTH_LABELS}
          />
        </div>

        {/* Column 3 */}
        <div>
          <KeyStatsDynamicCard
            ticker={ticker}
            title="Assets & Liabilities"
            apiPath="key-stats-assets-liabilities"
            rowLabels={ASSETS_LABELS}
          />
          <KeyStatsDynamicCard
            ticker={ticker}
            title="Returns"
            apiPath="key-stats-returns"
            rowLabels={RETURNS_LABELS}
          />
          <KeyStatsDynamicCard
            ticker={ticker}
            title="Dividends"
            apiPath="key-stats-dividends"
            rowLabels={DIVIDENDS_LABELS}
          />
          <KeyStatsDynamicCard ticker={ticker} title="Risk" apiPath="key-stats-risk" rowLabels={RISK_LABELS} />
        </div>
      </div>
    </div>
  );
}
