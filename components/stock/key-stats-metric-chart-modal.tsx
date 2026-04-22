"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { X } from "lucide-react";

import { TabSwitcher } from "@/components/design-system";
import { MultichartFundamentalsBar, sliceLastAnnualWithMetric } from "@/components/stock/multichart-fundamentals-bar";
import type { ChartingSeriesPoint, FundamentalsSeriesMode } from "@/lib/market/charting-series-types";
import {
  CHARTING_METRIC_LABEL,
  chartingMetricToParam,
  type ChartingMetricId,
} from "@/lib/market/stock-charting-metrics";

const PERIOD_TAB_OPTIONS = [
  { value: "annual" as const, label: "Annual" },
  { value: "quarterly" as const, label: "Quarterly" },
];

type Props = {
  ticker: string;
  metricId: ChartingMetricId | null;
  onClose: () => void;
  initialAnnualPoints?: ChartingSeriesPoint[];
  initialQuarterlyPoints?: ChartingSeriesPoint[];
};

export function KeyStatsMetricChartModal({
  ticker,
  metricId,
  onClose,
  initialAnnualPoints,
  initialQuarterlyPoints,
}: Props) {
  const [periodMode, setPeriodMode] = useState<FundamentalsSeriesMode>("annual");

  const seedPoints = useMemo(() => {
    if (periodMode === "quarterly") {
      return Array.isArray(initialQuarterlyPoints) && initialQuarterlyPoints.length > 0
        ? initialQuarterlyPoints
        : null;
    }
    return Array.isArray(initialAnnualPoints) && initialAnnualPoints.length > 0 ? initialAnnualPoints : null;
  }, [periodMode, initialAnnualPoints, initialQuarterlyPoints]);

  const [points, setPoints] = useState<ChartingSeriesPoint[]>(() =>
    Array.isArray(initialAnnualPoints) && initialAnnualPoints.length > 0 ? initialAnnualPoints : [],
  );
  const [loading, setLoading] = useState(
    !(Array.isArray(initialAnnualPoints) && initialAnnualPoints.length > 0),
  );

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (seedPoints) {
        setPoints(seedPoints);
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const res = await fetch(
          `/api/stocks/${encodeURIComponent(ticker)}/fundamentals-series?period=${
            periodMode === "quarterly" ? "quarterly" : "annual"
          }`,
          { credentials: "include" },
        );
        if (!res.ok) {
          if (!cancelled) setPoints([]);
          return;
        }
        const json = (await res.json()) as { points?: ChartingSeriesPoint[] };
        if (!cancelled) setPoints(Array.isArray(json.points) ? json.points : []);
      } catch {
        if (!cancelled) setPoints([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [ticker, periodMode, seedPoints]);

  const onKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose],
  );

  useEffect(() => {
    if (!metricId) return;
    document.addEventListener("keydown", onKeyDown);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prev;
    };
  }, [metricId, onKeyDown]);

  useEffect(() => {
    if (!metricId) setPeriodMode("annual");
  }, [metricId]);

  if (!metricId) return null;

  const maxBars = periodMode === "quarterly" ? 8 : 10;
  const hasSeries = sliceLastAnnualWithMetric(points, metricId, maxBars).length > 0;
  const chartingHref = `/stock/${encodeURIComponent(ticker.trim())}?tab=charting&metric=${encodeURIComponent(
    chartingMetricToParam(metricId),
  )}`;
  const title = CHARTING_METRIC_LABEL[metricId];

  return createPortal(
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="key-stats-metric-chart-title"
    >
      <button type="button" className="absolute inset-0 bg-black/40" aria-label="Close" onClick={onClose} />
      <div
        className="relative z-10 flex max-h-[min(90vh,720px)] w-full max-w-[min(560px,calc(100vw-2rem))] flex-col overflow-hidden rounded-xl border border-[#E4E4E7] bg-white shadow-[0px_10px_16px_-3px_rgba(10,10,10,0.1),0px_4px_6px_0px_rgba(10,10,10,0.04)]"
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-[#E4E4E7] px-5 py-4">
          <div className="min-w-0 flex-1">
            <h2 id="key-stats-metric-chart-title" className="text-[18px] font-semibold leading-7 text-[#09090B]">
              {title}
            </h2>
            <p className="mt-0.5 text-[14px] leading-5 text-[#71717A]">{ticker}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Link
              href={chartingHref}
              onClick={() => onClose()}
              className="rounded-[10px] px-3 py-2 text-[13px] font-medium text-[#2563EB] transition-colors hover:bg-[#F4F4F5]"
            >
              Charting
            </Link>
            <button
              type="button"
              onClick={onClose}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] text-[#71717A] transition-colors hover:bg-[#F4F4F5] hover:text-[#09090B]"
              aria-label="Close"
            >
              <X className="h-5 w-5" strokeWidth={2} />
            </button>
          </div>
        </div>

        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[#E4E4E7] px-5 py-3">
          <TabSwitcher
            options={PERIOD_TAB_OPTIONS}
            value={periodMode}
            onChange={setPeriodMode}
            aria-label="Reporting period"
          />
        </div>

        <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-5 py-4">
          {loading ? (
            <div className="flex h-[320px] items-center justify-center text-[14px] text-[#71717A]">Loading…</div>
          ) : !hasSeries ? (
            <p className="text-[14px] leading-6 text-[#71717A]">No data for this metric.</p>
          ) : (
            <div className="rounded-xl border border-[#E4E4E7] bg-white p-5 shadow-[0px_1px_2px_0px_rgba(10,10,10,0.06)]">
              <MultichartFundamentalsBar metricId={metricId} points={points} height={320} periodMode={periodMode} />
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
