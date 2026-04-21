"use client";

import { useMemo, useRef, useState } from "react";

import type { ChartingSeriesPoint, FundamentalsSeriesMode } from "@/lib/market/charting-series-types";
import {
  CHARTING_METRIC_FIELD,
  CHARTING_METRIC_KIND,
  CHARTING_METRIC_LABEL,
  type ChartingMetricId,
  type ChartingMetricKind,
} from "@/lib/market/stock-charting-metrics";
import {
  formatPercentMetric,
  formatRatio,
  formatUsdCompact,
  formatUsdPrice,
} from "@/lib/market/key-stats-basic-format";

/** Bar fill — matches {@link earnings-estimates-chart} `REPORTED_BAR` / estimates chart primary. */
const MULTICHART_BAR = "#2563EB";

/** Fixed bar width (px); extra horizontal space becomes even gaps (`justify-between`). */
const MULTICHART_BAR_WIDTH_PX = 14;

/** Left column for Y-axis tick labels (aligned to earnings chart left scale reserve). */
const MULTICHART_Y_AXIS_W_PX = 56;

/** Bottom row for period labels (px) — room for full year / short quarter text without clipping. */
const MULTICHART_AXIS_ROW_PX = 28;

export function readChartingMetricValue(row: ChartingSeriesPoint, id: ChartingMetricId): number | null {
  const k = CHARTING_METRIC_FIELD[id];
  const v = row[k];
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

/** Last `n` annual rows with a value for `metricId`, oldest → newest. */
export function sliceLastAnnualWithMetric(
  points: ChartingSeriesPoint[],
  metricId: ChartingMetricId,
  n: number,
): ChartingSeriesPoint[] {
  const sorted = [...points].sort((a, b) => a.periodEnd.localeCompare(b.periodEnd));
  const withVal = sorted.filter((r) => readChartingMetricValue(r, metricId) != null);
  return withVal.slice(-n);
}

/** Report year for the fiscal period (from `periodEnd`), e.g. `2024`. */
function formatAnnualYearLabel(periodEnd: string): string {
  const raw = periodEnd.trim();
  const d = new Date(raw.includes("T") ? raw : `${raw}T12:00:00.000Z`);
  if (!Number.isFinite(d.getTime())) return raw.slice(0, 4);
  return String(d.getUTCFullYear());
}

/** Full period string for tooltips — matches Charting copy. */
function formatMultichartPeriodLabel(periodEnd: string, mode: FundamentalsSeriesMode): string {
  const s = periodEnd.trim();
  if (mode === "annual") return formatAnnualYearLabel(s);
  const year = s.slice(0, 4);
  const m = s.slice(5, 7);
  const mm = /^\d{2}$/.test(m) ? Number(m) : NaN;
  const q = Number.isFinite(mm) ? Math.min(4, Math.max(1, Math.floor((mm - 1) / 3) + 1)) : null;
  return year && q ? `Q${q} ${year}` : s;
}

/** Short x-axis text (fits narrow columns); full label stays in tooltip via `title`. */
function formatMultichartPeriodAxisLabel(periodEnd: string, mode: FundamentalsSeriesMode): string {
  if (mode === "annual") return formatAnnualYearLabel(periodEnd);
  const s = periodEnd.trim();
  const year = s.slice(0, 4);
  const m = s.slice(5, 7);
  const mm = /^\d{2}$/.test(m) ? Number(m) : NaN;
  const q = Number.isFinite(mm) ? Math.min(4, Math.max(1, Math.floor((mm - 1) / 3) + 1)) : null;
  if (!year || !q) return s;
  const yy = year.length >= 2 ? year.slice(2) : year;
  return `Q${q} '${yy}`;
}

function formatAxisValue(kind: ChartingMetricKind, p: number): string {
  if (!Number.isFinite(p)) return "";
  switch (kind) {
    case "usd": {
      const abs = Math.abs(p);
      if (abs < 1e-9) return "$0";
      const neg = p < 0 ? "-" : "";
      if (abs >= 1e9) return `${neg}$${Math.round(abs / 1e9)}B`;
      if (abs >= 1e6) return `${neg}$${Math.round(abs / 1e6)}M`;
      if (abs >= 1e3) return `${neg}$${Math.round(abs / 1e3)}K`;
      return `${neg}$${abs.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
    }
    case "eps":
      return formatUsdPrice(p);
    case "percent":
      return formatPercentMetric(p);
    case "multiple":
    case "ratio":
      return formatRatio(p);
    default:
      return formatUsdCompact(p);
  }
}

function niceCeilPositive(n: number): number {
  if (!Number.isFinite(n) || n <= 0) return 1;
  const exp = Math.floor(Math.log10(n));
  const f = n / 10 ** exp;
  const nf = f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10;
  return nf * 10 ** exp;
}

type Props = {
  metricId: ChartingMetricId;
  points: ChartingSeriesPoint[];
  height?: number;
  periodMode?: FundamentalsSeriesMode;
};

type TipState = { clientX: number; clientY: number; text: string } | null;

export function MultichartFundamentalsBar({ metricId, points, height = 196, periodMode = "annual" }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [tip, setTip] = useState<TipState>(null);

  const kind = CHARTING_METRIC_KIND[metricId];
  const maxBars = periodMode === "quarterly" ? 8 : 7;
  const rows = useMemo(
    () => sliceLastAnnualWithMetric(points, metricId, maxBars),
    [points, metricId, maxBars],
  );

  const plotHeight = height - MULTICHART_AXIS_ROW_PX;

  const { values, labels, axisLabels, maxV, yTicks } = useMemo(() => {
    const vals: number[] = [];
    const labs: string[] = [];
    const axisLabs: string[] = [];
    for (const r of rows) {
      const v = readChartingMetricValue(r, metricId);
      if (v == null) continue;
      vals.push(v);
      labs.push(formatMultichartPeriodLabel(r.periodEnd, periodMode));
      axisLabs.push(formatMultichartPeriodAxisLabel(r.periodEnd, periodMode));
    }
    const rawMax = vals.length ? Math.max(...vals.map((x) => Math.abs(x))) : 0;
    const top = niceCeilPositive(rawMax || 1);
    const tickCount = 5;
    const ticks = Array.from({ length: tickCount }, (_, i) => (top * (tickCount - 1 - i)) / (tickCount - 1));
    return { values: vals, labels: labs, axisLabels: axisLabs, maxV: top, yTicks: ticks };
  }, [rows, metricId, periodMode]);

  const metricLabel = CHARTING_METRIC_LABEL[metricId];

  if (rows.length === 0 || values.length === 0) {
    return (
      <div className="w-full">
        <div
          className="flex h-[196px] items-center justify-center rounded-xl border border-dashed border-[#E4E4E7] bg-[#FAFAFA] text-[13px] text-[#71717A]"
          aria-hidden
        >
          No data
        </div>
      </div>
    );
  }

  const n = values.length;
  const plotGridTemplate = n > 0 ? `repeat(${n}, minmax(0, 1fr))` : undefined;

  return (
    <div ref={wrapRef} className="w-full min-w-0 max-w-full">
      <div className="relative flex w-full min-w-0 max-w-full flex-col" style={{ height }}>
        <div className="flex min-h-0 w-full min-w-0 flex-1" style={{ height: plotHeight }}>
          <div
            className="flex h-full shrink-0 flex-col justify-between border-r-0 pt-[8%] pb-[12%] pr-2 text-right font-['Inter'] text-[12px] tabular-nums leading-none text-[#71717A]"
            style={{ width: MULTICHART_Y_AXIS_W_PX }}
            aria-hidden
          >
            {yTicks.map((t, i) => (
              <span key={i} className="block">
                {formatAxisValue(kind, t)}
              </span>
            ))}
          </div>

          <div className="relative min-h-0 min-w-0 flex-1">
            <div className="pointer-events-none absolute inset-x-0 top-[8%] bottom-[12%]" aria-hidden>
              {yTicks.map((_, i) => {
                const nt = yTicks.length;
                const pct = nt <= 1 ? 0 : (i / (nt - 1)) * 100;
                return (
                  <div
                    key={i}
                    className="absolute left-0 right-0 border-t border-[#E4E4E7]"
                    style={{ top: `${pct}%` }}
                  />
                );
              })}
            </div>
            <div
              className="relative grid h-full min-h-0 w-full min-w-0 items-end px-0 pt-[8%] pb-[12%]"
              style={{ gridTemplateColumns: plotGridTemplate }}
              role="img"
              aria-label={`${metricLabel} bar chart`}
            >
              {values.map((v, i) => {
                const hPct = maxV > 0 ? (Math.max(0, v) / maxV) * 100 : 0;
                const tipText = `${metricLabel}\n${labels[i]}: ${formatAxisValue(kind, v)}`;
                return (
                  <div
                    key={`${labels[i]}-${i}`}
                    className="flex h-full min-h-0 min-w-0 flex-col items-center justify-end px-0.5"
                    onMouseEnter={(e) => {
                      setTip({ clientX: e.clientX, clientY: e.clientY, text: tipText });
                    }}
                    onMouseMove={(e) => {
                      setTip((prev) =>
                        prev ? { clientX: e.clientX, clientY: e.clientY, text: tipText } : null,
                      );
                    }}
                    onMouseLeave={() => setTip(null)}
                  >
                    <div
                      className="rounded-[2px] transition-[height] duration-75"
                      style={{
                        width: MULTICHART_BAR_WIDTH_PX,
                        maxWidth: "100%",
                        height: `${hPct}%`,
                        minHeight: hPct > 0 ? 2 : 0,
                        backgroundColor: MULTICHART_BAR,
                      }}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="flex w-full min-w-0" style={{ height: MULTICHART_AXIS_ROW_PX }}>
          <div style={{ width: MULTICHART_Y_AXIS_W_PX }} className="shrink-0" aria-hidden />
          <div
            className="grid min-w-0 flex-1 items-start px-0"
            style={{ gridTemplateColumns: plotGridTemplate }}
          >
            {axisLabels.map((axisLab, i) => (
              <div
                key={`${labels[i]}-${i}`}
                className="flex min-w-0 flex-col items-center justify-start px-0.5"
                title={labels[i]}
              >
                <span className="w-full text-balance text-center font-['Inter'] text-[11px] font-normal tabular-nums leading-snug text-[#71717A] sm:text-[12px]">
                  {axisLab}
                </span>
              </div>
            ))}
          </div>
        </div>

        {tip ? (
          <div
            className="pointer-events-none fixed z-[100] max-w-[min(280px,calc(100vw-16px))] whitespace-pre-line rounded-md border border-[#E4E4E7] bg-white px-2.5 py-1.5 text-left text-[12px] leading-snug text-[#18181B] shadow-sm"
            style={{ left: tip.clientX + 12, top: tip.clientY + 12 }}
          >
            {tip.text}
          </div>
        ) : null}
      </div>
    </div>
  );
}
