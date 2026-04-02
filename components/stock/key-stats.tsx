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

const LABEL_TO_METRIC: Partial<Record<string, ChartingMetricId>> = {
  Revenue: "revenue",
  "Gross Profit": "gross_profit",
  "Operating Income": "operating_income",
  "Net Income": "net_income",
  EBITDA: "ebitda",
  EPS: "eps",
};

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-[#E4E4E7] py-1.5 last:border-0">
      <span className="min-w-0 shrink cursor-pointer text-[14px] leading-5 text-[#09090B] underline decoration-[#E4E4E7] underline-offset-2">
        {label}
      </span>
      <span className="shrink-0 text-right text-[14px] leading-5 text-[#09090B] tabular-nums">{value}</span>
    </div>
  );
}

function RevenueStatRow({
  label,
  value,
  onMetricClick,
}: {
  label: string;
  value: string;
  onMetricClick?: (id: ChartingMetricId) => void;
}) {
  const metricId = LABEL_TO_METRIC[label];
  const interactive = typeof onMetricClick === "function" && metricId != null;
  return (
    <div className="flex items-center justify-between gap-3 border-b border-[#E4E4E7] py-1.5 last:border-0">
      {interactive ? (
        <button
          type="button"
          onClick={() => metricId && onMetricClick?.(metricId)}
          className="min-w-0 shrink cursor-pointer text-left text-[14px] leading-5 text-[#09090B] decoration-transparent underline-offset-2 hover:underline hover:decoration-[#D4D4D8]"
        >
          {label}
        </button>
      ) : (
        <span className="min-w-0 shrink text-[14px] leading-5 text-[#09090B]">{label}</span>
      )}
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
}: {
  title: string;
  rowLabels: string[];
  rows: Row[] | null;
  loading: boolean;
}) {
  const fallback = useMemo(() => rowLabels.map((label) => ({ label, value: "—" as const })), [rowLabels]);
  const displayRows = rows ?? fallback;

  return (
    <div className="mb-5 rounded-xl border border-[#E4E4E7] bg-white p-4">
      <h3 className="mb-2 text-[14px] font-semibold leading-5 text-[#09090B]">{title}</h3>
      {loading ? (
        <CardSkeleton rowLabels={rowLabels} />
      ) : (
        displayRows.map((row) => <StatRow key={row.label} label={row.label} value={row.value} />)
      )}
    </div>
  );
});

const BasicCard = memo(function BasicCard({ rows, loading }: { rows: Row[] | null; loading: boolean }) {
  const displayRows = rows ?? BASIC_FALLBACK;
  return (
    <div className="mb-5 rounded-xl border border-[#E4E4E7] bg-white p-4">
      <h3 className="mb-2 text-[14px] font-semibold leading-5 text-[#09090B]">Basic</h3>
      {loading ? (
        <CardSkeleton rowLabels={displayRows.map((r) => r.label)} />
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
  onMetricClick?: (id: ChartingMetricId) => void;
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
          <RevenueStatRow
            key={row.label}
            label={row.label}
            value={row.value}
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
  onRevenueProfitMetricClick,
}: {
  ticker: string;
  initialBundle?: StockKeyStatsBundle | null;
  onRevenueProfitMetricClick?: (id: ChartingMetricId) => void;
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
          <BasicCard rows={bundle?.basic ?? null} loading={loading} />
          <DynamicCard
            title="Valuation"
            rowLabels={VALUATION_LABELS}
            rows={bundle?.valuation ?? null}
            loading={loading}
          />
        </div>

        <div>
          <RevenueProfitCard
            rows={bundle?.revenueProfit ?? null}
            loading={loading}
            onMetricClick={onRevenueProfitMetricClick}
          />
          <DynamicCard title="Margins" rowLabels={MARGINS_LABELS} rows={bundle?.margins ?? null} loading={loading} />
          <DynamicCard title="Growth" rowLabels={GROWTH_LABELS} rows={bundle?.growth ?? null} loading={loading} />
        </div>

        <div>
          <DynamicCard
            title="Assets & Liabilities"
            rowLabels={ASSETS_LABELS}
            rows={bundle?.assetsLiabilities ?? null}
            loading={loading}
          />
          <DynamicCard title="Returns" rowLabels={RETURNS_LABELS} rows={bundle?.returns ?? null} loading={loading} />
          <DynamicCard
            title="Dividends"
            rowLabels={DIVIDENDS_LABELS}
            rows={bundle?.dividends ?? null}
            loading={loading}
          />
          <DynamicCard title="Risk" rowLabels={RISK_LABELS} rows={bundle?.risk ?? null} loading={loading} />
        </div>
      </div>
    </div>
  );
}

export const KeyStats = memo(KeyStatsInner);
