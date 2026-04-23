"use client";

import { useEffect, useState } from "react";

import type { ChartingMetricId } from "@/lib/market/stock-charting-metrics";

type Row = { label: string; value: string };

const LABEL_TO_METRIC: Partial<Record<string, ChartingMetricId>> = {
  Revenue: "revenue",
  "Gross Profit": "gross_profit",
  "Operating Income": "operating_income",
  "Net Income": "net_income",
  EBITDA: "ebitda",
  EPS: "eps",
  FCF: "free_cash_flow",
};

function StatRow({
  label,
  value,
  onLabelClick,
}: {
  label: string;
  value: string;
  onLabelClick?: () => void;
}) {
  const interactive = typeof onLabelClick === "function";
  return (
    <div className="flex items-center justify-between gap-3 border-b border-[#E4E4E7] py-1.5 last:border-0">
      {interactive ? (
        <button
          type="button"
          onClick={onLabelClick}
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

const PLACEHOLDER_ROWS: Row[] = [
  { label: "Revenue", value: "—" },
  { label: "Gross Profit", value: "—" },
  { label: "Operating Income", value: "—" },
  { label: "Net Income", value: "—" },
  { label: "EBITDA", value: "—" },
  { label: "EPS", value: "—" },
  { label: "FCF", value: "—" },
];

export function KeyStatsRevenueProfitCard({
  ticker,
  onMetricClick,
}: {
  ticker: string;
  onMetricClick?: (id: ChartingMetricId) => void;
}) {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Row[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const res = await fetch(`/api/stocks/${encodeURIComponent(ticker)}/key-stats-revenue-profit`, {
          cache: "no-store",
          credentials: "include",
        });
        if (!res.ok) {
          if (!cancelled) setRows(null);
          return;
        }
        const json = (await res.json()) as { rows?: Row[] | null };
        if (!cancelled) setRows(Array.isArray(json.rows) ? json.rows : null);
      } catch {
        if (!cancelled) setRows(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [ticker]);

  const displayRows = rows ?? PLACEHOLDER_ROWS;

  return (
    <div className="mb-5 rounded-xl border border-[#E4E4E7] bg-white p-4">
      <h3 className="mb-2 text-[14px] font-semibold leading-5 text-[#09090B]">Revenue &amp; Profit</h3>
      {loading ? (
        <div className="space-y-2 pt-0.5" aria-hidden>
          {displayRows.map((r) => (
            <div key={r.label} className="flex justify-between gap-3 border-b border-[#E4E4E7] py-1.5 last:border-0">
              <div className="h-4 w-28 rounded bg-neutral-100" />
              <div className="h-4 w-20 rounded bg-neutral-100" />
            </div>
          ))}
        </div>
      ) : (
        displayRows.map((row) => {
          const metricId = LABEL_TO_METRIC[row.label];
          return (
            <StatRow
              key={row.label}
              label={row.label}
              value={row.value}
              onLabelClick={
                onMetricClick && metricId ? () => onMetricClick(metricId) : undefined
              }
            />
          );
        })
      )}
    </div>
  );
}
