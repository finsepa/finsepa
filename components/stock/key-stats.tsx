"use client";

import type { ChartingMetricId } from "@/lib/market/stock-charting-metrics";
import type { StockKeyStatsBundle } from "@/lib/market/stock-key-stats-bundle-types";
import { memo, useEffect, useMemo, useState } from "react";

type Row = { label: string; value: string };

const ASSETS_LABELS = [
  "Total Assets",
  "Cash on Hand",
  "Long Term Debt",
  "Total Liabilities",
  "Share Holder Equity",
  "Debt/Equity",
];

const ASSETS_LABEL_TO_METRIC: Partial<Record<string, ChartingMetricId>> = {
  "Total Assets": "total_assets",
  "Cash on Hand": "cash_on_hand",
  "Long Term Debt": "long_term_debt",
  "Total Liabilities": "total_liabilities",
  "Share Holder Equity": "shareholder_equity",
  "Debt/Equity": "debt_to_equity",
};

const RETURNS_LABELS = [
  "Return on Equity (ROE)",
  "Return on Assets (ROA)",
  "Return on Capital Employed (ROCE)",
  "Return on Investments (ROI)",
];

const RETURNS_LABEL_TO_METRIC: Partial<Record<string, ChartingMetricId>> = {
  "Return on Equity (ROE)": "return_on_equity",
  "Return on Assets (ROA)": "return_on_assets",
  "Return on Capital Employed (ROCE)": "return_on_capital_employed",
  "Return on Investments (ROI)": "return_on_investment",
};

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

const GROWTH_LABEL_TO_METRIC: Partial<Record<string, ChartingMetricId>> = {
  "Quarterly Revenue (YoY)": "revenue_yoy",
  "Revenue (3Y)": "revenue_3y_cagr",
  "Quarterly EPS (YoY)": "eps_yoy",
  "EPS (3Y)": "eps_3y_cagr",
};

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

const VALUATION_LABEL_TO_METRIC: Partial<Record<string, ChartingMetricId>> = {
  "P/E Ratio": "pe_ratio",
  "Trailing P/E": "trailing_pe",
  "Forward P/E": "forward_pe",
  "P/S Ratio": "ps_ratio",
  "Price/Book Ratio": "price_book",
  "Price/FCF Ratio": "price_fcf",
  "EV/EBITDA": "ev_ebitda",
  "EV/Sales": "ev_sales",
  "Cash/Debt": "cash_debt",
};

const DIVIDENDS_LABELS = ["Yield", "Payout"];

const DIVIDENDS_LABEL_TO_METRIC: Partial<Record<string, ChartingMetricId>> = {
  Yield: "dividend_yield",
  Payout: "payout_ratio",
};

const RISK_LABELS = ["Beta (5Y)", "Max Drawdown (5Y)"];

const REVENUE_PROFIT_LABEL_TO_METRIC: Partial<Record<string, ChartingMetricId>> = {
  Revenue: "revenue",
  "Gross Profit": "gross_profit",
  "Operating Income": "operating_income",
  "Net Income": "net_income",
  EBITDA: "ebitda",
  EPS: "eps",
  /** Dollar FCF — see `eodhd-key-stats-revenue-profit` (Margins card uses “Free Cash Flow” for margin %). */
  FCF: "free_cash_flow",
};

/** Key Stats "Margins" row labels → fundamentals chart metric (FCF row is margin %, not cash dollars). */
const MARGINS_LABEL_TO_METRIC: Partial<Record<string, ChartingMetricId>> = {
  "Gross Margin": "gross_margin",
  "Operating Margin": "operating_margin",
  "EBITDA Margin": "ebitda_margin",
  "Pre-Tax Margin": "pre_tax_margin",
  "Net Margin": "net_margin",
  "Free Cash Flow": "fcf_margin",
};

const BASIC_FALLBACK: Row[] = [
  { label: "Market Cap", value: "—" },
  { label: "Enterprise Value", value: "—" },
  { label: "Shares Outstanding", value: "—" },
  { label: "1Y Target Est", value: "—" },
  { label: "Fair Value", value: "—" },
  { label: "Earnings Date", value: "—" },
  { label: "Beta (5Y Monthly)", value: "—" },
  { label: "Employees", value: "—" },
];

/** Basic rows that open the same fundamentals chart modal as Revenue & Profit. */
const BASIC_LABEL_TO_METRIC: Partial<Record<string, ChartingMetricId>> = {
  "Market Cap": "market_cap",
  "Enterprise Value": "enterprise_value",
  "Shares Outstanding": "shares_outstanding",
};

function KeyStatMetricRow({
  label,
  value,
  labelToMetric,
  onMetricClick,
}: {
  label: string;
  value: string;
  labelToMetric: Partial<Record<string, ChartingMetricId>>;
  onMetricClick?: (metricId: ChartingMetricId) => void;
}) {
  const metricId = labelToMetric[label];
  const interactive = typeof onMetricClick === "function" && metricId != null;
  if (!interactive) {
    return <StatRow label={label} value={value} />;
  }
  return (
    <button
      type="button"
      onClick={() => metricId && onMetricClick?.(metricId)}
      className="flex w-full min-w-0 cursor-pointer items-center justify-between gap-3 border-b border-[#E4E4E7] py-1.5 text-left last:border-0 hover:bg-[#FAFAFA]"
    >
      <span className="min-w-0 shrink text-[14px] leading-5 text-[#09090B] decoration-transparent underline-offset-2 hover:underline hover:decoration-[#71717A]">
        {label}
      </span>
      <span className="shrink-0 text-right text-[14px] leading-5 text-[#09090B] tabular-nums">{value}</span>
    </button>
  );
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-[#E4E4E7] py-1.5 last:border-0">
      <span className="min-w-0 shrink text-[14px] leading-5 text-[#09090B]">{label}</span>
      <span className="shrink-0 text-right text-[14px] leading-5 text-[#09090B] tabular-nums">{value}</span>
    </div>
  );
}

function CardSkeleton({ rowLabels }: { rowLabels: string[] }) {
  return (
    <div className="space-y-2 pt-0.5" aria-hidden>
      {rowLabels.map((label) => (
        <div key={label} className="flex justify-between gap-3 border-b border-[#E4E4E7] py-1.5 last:border-0">
          <div className="h-4 w-28 rounded bg-neutral-100" />
          <div className="h-4 w-20 rounded bg-neutral-100" />
        </div>
      ))}
    </div>
  );
}

const DynamicCard = memo(function DynamicCard({
  title,
  rowLabels,
  rows,
  loading,
  labelToMetric,
  onMetricClick,
}: {
  title: string;
  rowLabels: string[];
  rows: Row[] | null;
  loading: boolean;
  /** When set with `onMetricClick`, matching rows open the fundamentals chart modal (label + value clickable). */
  labelToMetric?: Partial<Record<string, ChartingMetricId>>;
  onMetricClick?: (metricId: ChartingMetricId) => void;
}) {
  const fallback = useMemo(() => rowLabels.map((label) => ({ label, value: "—" as const })), [rowLabels]);
  const displayRows = rows ?? fallback;
  const map = labelToMetric ?? null;
  const clickable = map != null && typeof onMetricClick === "function";

  return (
    <div className="mb-5 rounded-xl border border-[#E4E4E7] bg-white p-4">
      <h3 className="mb-2 text-[14px] font-semibold leading-5 text-[#09090B]">{title}</h3>
      {loading ? (
        <CardSkeleton rowLabels={rowLabels} />
      ) : clickable ? (
        displayRows.map((row) => (
          <KeyStatMetricRow
            key={row.label}
            label={row.label}
            value={row.value}
            labelToMetric={map}
            onMetricClick={onMetricClick}
          />
        ))
      ) : (
        displayRows.map((row) => <StatRow key={row.label} label={row.label} value={row.value} />)
      )}
    </div>
  );
});

const BasicCard = memo(function BasicCard({
  rows,
  loading,
  onMetricClick,
}: {
  rows: Row[] | null;
  loading: boolean;
  onMetricClick?: (metricId: ChartingMetricId) => void;
}) {
  const displayRows = rows ?? BASIC_FALLBACK;
  const clickable = typeof onMetricClick === "function";

  return (
    <div className="mb-5 rounded-xl border border-[#E4E4E7] bg-white p-4">
      <h3 className="mb-2 text-[14px] font-semibold leading-5 text-[#09090B]">Basic</h3>
      {loading ? (
        <CardSkeleton rowLabels={displayRows.map((r) => r.label)} />
      ) : clickable ? (
        displayRows.map((row) => (
          <KeyStatMetricRow
            key={row.label}
            label={row.label}
            value={row.value}
            labelToMetric={BASIC_LABEL_TO_METRIC}
            onMetricClick={onMetricClick}
          />
        ))
      ) : (
        displayRows.map((row) => <StatRow key={row.label} label={row.label} value={row.value} />)
      )}
    </div>
  );
});

const RevenueProfitCard = memo(function RevenueProfitCard({
  rows,
  loading,
  onMetricClick,
}: {
  rows: Row[] | null;
  loading: boolean;
  onMetricClick?: (metricId: ChartingMetricId) => void;
}) {
  const placeholder = useMemo(
    () =>
      [
        { label: "Revenue", value: "—" },
        { label: "Gross Profit", value: "—" },
        { label: "Operating Income", value: "—" },
        { label: "Net Income", value: "—" },
        { label: "EBITDA", value: "—" },
        { label: "EPS", value: "—" },
        { label: "FCF", value: "—" },
      ] satisfies Row[],
    [],
  );
  const displayRows = rows ?? placeholder;

  return (
    <div className="mb-5 rounded-xl border border-[#E4E4E7] bg-white p-4">
      <h3 className="mb-2 text-[14px] font-semibold leading-5 text-[#09090B]">Revenue &amp; Profit</h3>
      {loading ? (
        <CardSkeleton rowLabels={displayRows.map((r) => r.label)} />
      ) : (
        displayRows.map((row) => (
          <KeyStatMetricRow
            key={row.label}
            label={row.label}
            value={row.value}
            labelToMetric={REVENUE_PROFIT_LABEL_TO_METRIC}
            onMetricClick={onMetricClick}
          />
        ))
      )}
    </div>
  );
});

function KeyStatsInner({
  ticker,
  initialBundle,
  onOpenMetricChart,
}: {
  ticker: string;
  initialBundle?: StockKeyStatsBundle | null;
  /** Dividends (Yield / Payout) and all other listed Key Stats rows with a charting metric open the fundamentals modal. Risk rows have no fiscal series. */
  onOpenMetricChart?: (metricId: ChartingMetricId) => void;
}) {
  const [loading, setLoading] = useState(() => !initialBundle);
  const [bundle, setBundle] = useState<StockKeyStatsBundle | null>(() => initialBundle ?? null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (initialBundle) setBundle(initialBundle);
      if (!initialBundle) setLoading(true);
      try {
        const res = await fetch(
          `/api/stocks/${encodeURIComponent(ticker)}/key-stats-bundle?refresh=1`,
          { credentials: "include", cache: "no-store" },
        );
        if (!res.ok) return;
        const json = (await res.json()) as { bundle?: StockKeyStatsBundle | null };
        if (!cancelled) setBundle(json.bundle ?? null);
      } catch {
        /* keep SSR / prior bundle */
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [ticker, initialBundle]);

  return (
    <div>
      <h2 className="text-[18px] font-semibold leading-7 text-[#09090B] mb-4">Key Stats</h2>
      <div className="grid grid-cols-3 gap-5">
        <div>
          <BasicCard rows={bundle?.basic ?? null} loading={loading} onMetricClick={onOpenMetricChart} />
          <DynamicCard
            title="Valuation"
            rowLabels={VALUATION_LABELS}
            rows={bundle?.valuation ?? null}
            loading={loading}
            labelToMetric={VALUATION_LABEL_TO_METRIC}
            onMetricClick={onOpenMetricChart}
          />
        </div>

        <div>
          <RevenueProfitCard
            rows={bundle?.revenueProfit ?? null}
            loading={loading}
            onMetricClick={onOpenMetricChart}
          />
          <DynamicCard
            title="Margins"
            rowLabels={MARGINS_LABELS}
            rows={bundle?.margins ?? null}
            loading={loading}
            labelToMetric={MARGINS_LABEL_TO_METRIC}
            onMetricClick={onOpenMetricChart}
          />
          <DynamicCard
            title="Growth"
            rowLabels={GROWTH_LABELS}
            rows={bundle?.growth ?? null}
            loading={loading}
            labelToMetric={GROWTH_LABEL_TO_METRIC}
            onMetricClick={onOpenMetricChart}
          />
        </div>

        <div>
          <DynamicCard
            title="Assets & Liabilities"
            rowLabels={ASSETS_LABELS}
            rows={bundle?.assetsLiabilities ?? null}
            loading={loading}
            labelToMetric={ASSETS_LABEL_TO_METRIC}
            onMetricClick={onOpenMetricChart}
          />
          <DynamicCard
            title="Returns"
            rowLabels={RETURNS_LABELS}
            rows={bundle?.returns ?? null}
            loading={loading}
            labelToMetric={RETURNS_LABEL_TO_METRIC}
            onMetricClick={onOpenMetricChart}
          />
          <DynamicCard
            title="Dividends"
            rowLabels={DIVIDENDS_LABELS}
            rows={bundle?.dividends ?? null}
            loading={loading}
            labelToMetric={DIVIDENDS_LABEL_TO_METRIC}
            onMetricClick={onOpenMetricChart}
          />
          <DynamicCard title="Risk" rowLabels={RISK_LABELS} rows={bundle?.risk ?? null} loading={loading} />
        </div>
      </div>
    </div>
  );
}

export const KeyStats = memo(KeyStatsInner);
