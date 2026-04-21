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
import { EARNINGS_CARD_LABEL_CLASS, EARNINGS_CARD_VALUE_CLASS } from "@/components/stock/earnings-card-styles";
import { TabSwitcher } from "@/components/design-system";
import type { FundamentalsSeriesMode } from "@/lib/market/charting-series-types";

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

const PERIOD_TAB_OPTIONS = [
  { value: "annual" as const, label: "Annual" },
  { value: "quarterly" as const, label: "Quarterly" },
];

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
  initialQuarterlyPoints?: ChartingSeriesPoint[];
};

export function StockMultichartsTab({ ticker, initialAnnualPoints, initialQuarterlyPoints }: Props) {
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

  const maxBars = periodMode === "quarterly" ? 8 : 7;
  const hasAny = useMemo(
    () => MULTICHART_METRICS.some((id) => sliceLastAnnualWithMetric(points, id, maxBars).length > 0),
    [points, maxBars],
  );

  return (
    <div className="space-y-6 pt-1">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <h2 className="text-[20px] font-semibold leading-8 tracking-tight text-[#09090B]">Multicharts</h2>
        <TabSwitcher
          options={PERIOD_TAB_OPTIONS}
          value={periodMode}
          onChange={setPeriodMode}
          aria-label="Reporting period"
        />
      </div>

      {loading ? (
        <MultichartsTabSkeletonGrid />
      ) : !hasAny ? (
        <p className="text-[14px] leading-6 text-[#71717A]">No fundamentals data available for this symbol.</p>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
          {MULTICHART_METRICS.map((metricId) => (
            <MultichartCard key={metricId} metricId={metricId} points={points} periodMode={periodMode} />
          ))}
        </div>
      )}
    </div>
  );
}

function MultichartCard({
  metricId,
  points,
  periodMode,
}: {
  metricId: ChartingMetricId;
  points: ChartingSeriesPoint[];
  periodMode: FundamentalsSeriesMode;
}) {
  const maxBars = periodMode === "quarterly" ? 8 : 7;
  const rows = useMemo(() => sliceLastAnnualWithMetric(points, metricId, maxBars), [points, metricId, maxBars]);
  const last = rows.length ? readChartingMetricValue(rows[rows.length - 1]!, metricId) : null;
  const yoy = yoyFromLastTwo(rows, metricId);
  const deltaLabel = periodMode === "quarterly" ? "QoQ" : "YoY";

  return (
    <div className={MULTICHART_CARD_CLASS}>
      <div className="mb-4 min-w-0">
        <p className={EARNINGS_CARD_LABEL_CLASS}>{CHARTING_METRIC_LABEL[metricId]}</p>
        {last != null && Number.isFinite(last) ? (
          <div className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-0">
            <span className={`${EARNINGS_CARD_VALUE_CLASS} tabular-nums`}>{formatHeadlineValue(metricId, last)}</span>
            {yoy != null && Number.isFinite(yoy) ? (
              <span
                className={`font-['Inter'] text-[14px] font-medium tabular-nums leading-5 ${
                  yoy >= 0 ? "text-[#16A34A]" : "text-[#DC2626]"
                }`}
              >
                ({yoy >= 0 ? "+" : ""}
                {yoy.toFixed(1)}% {deltaLabel})
              </span>
            ) : null}
          </div>
        ) : null}
      </div>
      <MultichartFundamentalsBar metricId={metricId} points={points} height={300} periodMode={periodMode} />
    </div>
  );
}
