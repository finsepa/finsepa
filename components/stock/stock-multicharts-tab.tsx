"use client";

import { useEffect, useMemo, useState } from "react";

import { MultichartFundamentalsBar, readChartingMetricValue, sliceLastAnnualWithMetric } from "@/components/stock/multichart-fundamentals-bar";
import type { ChartingSeriesPoint } from "@/lib/market/charting-series-types";
import {
  CHARTING_METRIC_KIND,
  CHARTING_METRIC_LABEL,
  type ChartingMetricId,
} from "@/lib/market/stock-charting-metrics";
import {
  formatPercentMetric,
  formatRatio,
  formatUsdCompact,
  formatUsdPrice,
} from "@/lib/market/key-stats-basic-format";
import { MultichartsTabSkeletonGrid } from "@/components/stock/stock-multicharts-tab-skeleton";

/** Matches earnings / screener index cards (`stock-earnings-tab.tsx`). */
const MULTICHART_CARD_CLASS =
  "overflow-hidden rounded-xl border border-[#E4E4E7] bg-white px-4 py-4 shadow-[0px_1px_2px_0px_rgba(10,10,10,0.06)] transition hover:shadow-[0px_2px_4px_0px_rgba(10,10,10,0.08)]";

const MULTICHART_METRICS = [
  "revenue",
  "net_income",
  "eps",
  "free_cash_flow",
  "ebitda",
] as const satisfies readonly ChartingMetricId[];

function yoyFromLastTwo(rows: ChartingSeriesPoint[], metricId: ChartingMetricId): number | null {
  if (rows.length < 2) return null;
  const a = readChartingMetricValue(rows[rows.length - 1]!, metricId);
  const b = readChartingMetricValue(rows[rows.length - 2]!, metricId);
  if (a == null || b == null || b === 0) return null;
  return ((a / b) - 1) * 100;
}

function formatHeadlineValue(metricId: ChartingMetricId, v: number): string {
  const kind = CHARTING_METRIC_KIND[metricId];
  switch (kind) {
    case "usd":
      return formatUsdCompact(v);
    case "eps":
      return formatUsdPrice(v);
    case "percent":
      return formatPercentMetric(v);
    case "multiple":
    case "ratio":
      return formatRatio(v);
    default:
      return formatUsdCompact(v);
  }
}

type Props = {
  ticker: string;
  initialAnnualPoints?: ChartingSeriesPoint[];
};

export function StockMultichartsTab({ ticker, initialAnnualPoints }: Props) {
  const [points, setPoints] = useState<ChartingSeriesPoint[]>(() => initialAnnualPoints ?? []);
  const [loading, setLoading] = useState(!initialAnnualPoints?.length);

  useEffect(() => {
    setPoints(initialAnnualPoints ?? []);
    setLoading(!initialAnnualPoints?.length);
  }, [initialAnnualPoints, ticker]);

  useEffect(() => {
    if (initialAnnualPoints && initialAnnualPoints.length > 0) return;
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/stocks/${encodeURIComponent(ticker)}/fundamentals-series?period=annual`,
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
  }, [ticker, initialAnnualPoints]);

  const hasAny = useMemo(() => MULTICHART_METRICS.some((id) => sliceLastAnnualWithMetric(points, id, 7).length > 0), [points]);

  return (
    <div className="space-y-6 pt-1">
      <h2 className="text-[20px] font-semibold leading-8 tracking-tight text-[#09090B]">Multicharts</h2>

      {loading ? (
        <MultichartsTabSkeletonGrid />
      ) : !hasAny ? (
        <p className="text-[14px] leading-6 text-[#71717A]">No fundamentals data available for this symbol.</p>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
          {MULTICHART_METRICS.map((metricId) => (
            <MultichartCard key={metricId} metricId={metricId} points={points} />
          ))}
        </div>
      )}
    </div>
  );
}

function MultichartCard({ metricId, points }: { metricId: ChartingMetricId; points: ChartingSeriesPoint[] }) {
  const rows = useMemo(() => sliceLastAnnualWithMetric(points, metricId, 7), [points, metricId]);
  const last = rows.length ? readChartingMetricValue(rows[rows.length - 1]!, metricId) : null;
  const yoy = yoyFromLastTwo(rows, metricId);

  return (
    <div className={MULTICHART_CARD_CLASS}>
      <div className="mb-3 min-w-0">
        <h3 className="text-[16px] font-semibold leading-6 text-[#09090B]">{CHARTING_METRIC_LABEL[metricId]}</h3>
        {last != null && Number.isFinite(last) ? (
          <div className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-0">
            <span className="text-[18px] font-semibold tabular-nums leading-7 text-[#09090B]">
              {formatHeadlineValue(metricId, last)}
            </span>
            {yoy != null && Number.isFinite(yoy) ? (
              <span
                className={`text-[14px] font-medium tabular-nums leading-5 ${
                  yoy >= 0 ? "text-[#16A34A]" : "text-[#DC2626]"
                }`}
              >
                ({yoy >= 0 ? "+" : ""}
                {yoy.toFixed(1)}% YoY)
              </span>
            ) : null}
          </div>
        ) : null}
      </div>
      <MultichartFundamentalsBar metricId={metricId} points={points} height={196} />
    </div>
  );
}
