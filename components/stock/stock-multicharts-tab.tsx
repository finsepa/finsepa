"use client";

import { BarChart3, LineChart, TrendingDown, TrendingUp } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import {
  MultichartFundamentalsBar,
  readChartingMetricValue,
  sliceLastAnnualWithMetric,
  type MultichartVisual,
} from "@/components/stock/multichart-fundamentals-bar";
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
import { cn } from "@/lib/utils";
import type { FundamentalsSeriesMode } from "@/lib/market/charting-series-types";

/** Multicharts card — Figma: 20px padding, 12px radius, 1px #E4E4E7 stroke, 8px vertical gap between blocks. */
const MULTICHART_CARD_CLASS =
  "flex flex-col gap-2 overflow-x-hidden overflow-y-visible rounded-xl border border-[#E4E4E7] bg-white p-5 shadow-[0px_1px_2px_0px_rgba(10,10,10,0.06)] transition hover:shadow-[0px_2px_4px_0px_rgba(10,10,10,0.08)]";

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

const CHART_VISUAL_OPTIONS = [
  { value: "line" as const, label: "Line chart", Icon: LineChart },
  { value: "bar" as const, label: "Bar chart", Icon: BarChart3 },
] as const;

function MultichartVisualSwitcher({
  value,
  onChange,
}: {
  value: MultichartVisual;
  onChange: (next: MultichartVisual) => void;
}) {
  return (
    <div
      className="inline-flex shrink-0 items-center gap-0 rounded-[10px] bg-[#F4F4F5] p-0.5"
      role="group"
      aria-label="Chart style"
    >
      {CHART_VISUAL_OPTIONS.map(({ value: v, label, Icon }) => {
        const active = value === v;
        return (
          <button
            key={v}
            type="button"
            aria-pressed={active}
            aria-label={label}
            title={label}
            onClick={() => onChange(v)}
            className={cn(
              "flex h-9 w-9 items-center justify-center rounded-[10px] transition-colors duration-100",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#09090B]/15 focus-visible:ring-offset-2",
              active
                ? "bg-white text-[#09090B] shadow-[0px_1px_4px_0px_rgba(10,10,10,0.12),0px_1px_2px_0px_rgba(10,10,10,0.07)]"
                : "text-[#71717A] hover:text-[#09090B]",
            )}
          >
            <Icon className="h-4 w-4" strokeWidth={2} aria-hidden />
          </button>
        );
      })}
    </div>
  );
}

function yoyFromLastTwo(rows: ChartingSeriesPoint[], metricId: ChartingMetricId): number | null {
  if (rows.length < 2) return null;
  const a = readChartingMetricValue(rows[rows.length - 1]!, metricId);
  const b = readChartingMetricValue(rows[rows.length - 2]!, metricId);
  if (a == null || b == null || b === 0) return null;
  return ((a / b) - 1) * 100;
}

/** Prior period label for delta copy — matches x-axis style (`2024` annual, `Q3 '25` quarterly). */
function priorComparisonPeriodLabel(priorPeriodEnd: string, mode: FundamentalsSeriesMode): string {
  const raw = priorPeriodEnd.trim();
  if (mode === "annual") {
    const d = new Date(raw.includes("T") ? raw : `${raw}T12:00:00.000Z`);
    if (!Number.isFinite(d.getTime())) return raw.slice(0, 4);
    return String(d.getUTCFullYear());
  }
  const s = raw;
  const year = s.slice(0, 4);
  const m = s.slice(5, 7);
  const mm = /^\d{2}$/.test(m) ? Number(m) : NaN;
  const q = Number.isFinite(mm) ? Math.min(4, Math.max(1, Math.floor((mm - 1) / 3) + 1)) : null;
  if (!year || !q) return s;
  const yy = year.length >= 2 ? year.slice(2) : year;
  return `Q${q} '${yy}`;
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
  const [chartVisual, setChartVisual] = useState<MultichartVisual>("bar");

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

  const maxBars = periodMode === "quarterly" ? 8 : 10;
  const hasAny = useMemo(
    () => MULTICHART_METRICS.some((id) => sliceLastAnnualWithMetric(points, id, maxBars).length > 0),
    [points, maxBars],
  );

  return (
    <div className="space-y-6 pt-1">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <h2 className="text-[20px] font-semibold leading-8 tracking-tight text-[#09090B]">Multicharts</h2>
        <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-3">
          <TabSwitcher
            options={PERIOD_TAB_OPTIONS}
            value={periodMode}
            onChange={setPeriodMode}
            aria-label="Reporting period"
          />
          <MultichartVisualSwitcher value={chartVisual} onChange={setChartVisual} />
        </div>
      </div>

      {loading ? (
        <MultichartsTabSkeletonGrid />
      ) : !hasAny ? (
        <p className="text-[14px] leading-6 text-[#71717A]">No fundamentals data available for this symbol.</p>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
          {MULTICHART_METRICS.map((metricId) => (
            <MultichartCard
              key={metricId}
              metricId={metricId}
              points={points}
              periodMode={periodMode}
              chartVisual={chartVisual}
            />
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
  chartVisual,
}: {
  metricId: ChartingMetricId;
  points: ChartingSeriesPoint[];
  periodMode: FundamentalsSeriesMode;
  chartVisual: MultichartVisual;
}) {
  const maxBars = periodMode === "quarterly" ? 8 : 10;
  const rows = useMemo(() => sliceLastAnnualWithMetric(points, metricId, maxBars), [points, metricId, maxBars]);
  const last = rows.length ? readChartingMetricValue(rows[rows.length - 1]!, metricId) : null;
  const yoy = yoyFromLastTwo(rows, metricId);
  const priorRow = rows.length >= 2 ? rows[rows.length - 2]! : null;

  return (
    <div className={MULTICHART_CARD_CLASS}>
      <div className="min-w-0">
        <p className={EARNINGS_CARD_LABEL_CLASS}>{CHARTING_METRIC_LABEL[metricId]}</p>
        {last != null && Number.isFinite(last) ? (
          <div className="mt-1 flex min-w-0 flex-col items-start gap-0.5">
            <span className={`${EARNINGS_CARD_VALUE_CLASS} tabular-nums`}>{formatHeadlineValue(metricId, last)}</span>
            {yoy != null && Number.isFinite(yoy) && priorRow != null ? (
              <span className="inline-flex items-center gap-1 font-['Inter'] text-[14px] font-medium tabular-nums leading-5">
                {yoy > 0 ? (
                  <TrendingUp className="h-3.5 w-3.5 shrink-0 text-[#16A34A]" strokeWidth={2.25} aria-hidden />
                ) : yoy < 0 ? (
                  <TrendingDown className="h-3.5 w-3.5 shrink-0 text-[#DC2626]" strokeWidth={2.25} aria-hidden />
                ) : null}
                <span className={yoy >= 0 ? "text-[#16A34A]" : "text-[#DC2626]"}>
                  {yoy >= 0 ? "+" : ""}
                  {yoy.toFixed(1)}
                </span>
                <span className="text-[#71717A]">
                  vs {priorComparisonPeriodLabel(priorRow.periodEnd, periodMode)}
                </span>
              </span>
            ) : null}
          </div>
        ) : null}
      </div>
      <MultichartFundamentalsBar
        metricId={metricId}
        points={points}
        height={278}
        periodMode={periodMode}
        visual={chartVisual}
      />
    </div>
  );
}
