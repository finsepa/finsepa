"use client";

import { useEffect, useMemo, useRef } from "react";
import {
  ColorType,
  CrosshairMode,
  HistogramSeries,
  LineStyle,
  createChart,
  type IChartApi,
  type Time,
  type UTCTimestamp,
} from "lightweight-charts";

import type { ChartingSeriesPoint } from "@/lib/market/charting-series-types";
import {
  CHARTING_METRIC_FIELD,
  CHARTING_METRIC_KIND,
  type ChartingMetricId,
  type ChartingMetricKind,
} from "@/lib/market/stock-charting-metrics";
import {
  formatPercentMetric,
  formatRatio,
  formatUsdCompact,
  formatUsdPrice,
} from "@/lib/market/key-stats-basic-format";

/** Multicharts bar fill — aligned to reference (vibrant blue, e.g. Material blue). */
const MULTICHART_BAR = "#2962FF";

/** Evenly spaced logical timestamps so bars fill the plot (avoids multi-year calendar gaps). */
const MULTICHART_BAR_SLOT_SECONDS = 86400;

/** User-requested gap between histogram columns (`HorzScaleOptions.barSpacing`). */
const MULTICHART_BAR_SPACING_PX = 20;

/** Fallback subtract when `timeScale().width()` is not ready yet (y-axis on the left). */
const MULTICHART_PRICE_SCALE_RESERVE_PX = 56;

/**
 * Extra logical range on each side of the data so the first/last histogram columns are not clipped
 * (half-width past the bar center).
 */
const MULTICHART_TIME_SCALE_EDGE_PAD_LOGICAL = 0.65;

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

/** Sequential bar slot times — dense enough that the time axis can place a tick per bar. */
function indexToBarSlotTime(i: number): UTCTimestamp {
  const anchor = Date.UTC(2020, 0, 1) / 1000;
  return (anchor + i * MULTICHART_BAR_SLOT_SECONDS) as UTCTimestamp;
}

/** Report year for the fiscal period (from `periodEnd`), e.g. `2024`. */
function formatAnnualYearLabel(periodEnd: string): string {
  const raw = periodEnd.trim();
  const d = new Date(raw.includes("T") ? raw : `${raw}T12:00:00.000Z`);
  if (!Number.isFinite(d.getTime())) return raw.slice(0, 4);
  return String(d.getUTCFullYear());
}

function timeToUnixSeconds(time: Time): number | null {
  if (typeof time === "number" && Number.isFinite(time)) return time;
  if (typeof time === "string") {
    const t = Date.parse(time);
    return Number.isFinite(t) ? Math.floor(t / 1000) : null;
  }
  if (time && typeof time === "object" && "year" in time) {
    const bd = time as { year: number; month: number; day: number };
    return Math.floor(Date.UTC(bd.year, bd.month - 1, bd.day) / 1000);
  }
  return null;
}

/**
 * Locks horizontal distance between bar centers to {@link MULTICHART_BAR_SPACING_PX} so gaps stay
 * visible (scaling spacing up was making histogram columns wide enough to look flush).
 */
function layoutMultichartTimeScale(chart: IChartApi, containerWidthPx: number, layoutAttempt = 0): void {
  const ts = chart.timeScale();
  const plotFallback = Math.max(120, containerWidthPx - MULTICHART_PRICE_SCALE_RESERVE_PX);
  ts.fitContent();
  requestAnimationFrame(() => {
    const lr = ts.getVisibleLogicalRange();
    if (lr === null) return;
    const pad = MULTICHART_TIME_SCALE_EDGE_PAD_LOGICAL;
    ts.setVisibleLogicalRange({
      from: lr.from - pad,
      to: lr.to + pad,
    });

    requestAnimationFrame(() => {
      const lr2 = ts.getVisibleLogicalRange();
      if (lr2 === null) return;
      const measuredPlot = ts.width();
      const plotW = measuredPlot > 8 ? measuredPlot : plotFallback;
      if (plotW < 16 && layoutAttempt < 4) {
        layoutMultichartTimeScale(chart, containerWidthPx, layoutAttempt + 1);
        return;
      }
      if (plotW < 16) return;

      const gap = MULTICHART_BAR_SPACING_PX;
      ts.applyOptions({
        barSpacing: gap,
        minBarSpacing: gap,
        /** Hard-cap so spacing never scales up — keeps clear gaps between columns. */
        maxBarSpacing: gap,
        fixLeftEdge: false,
        fixRightEdge: false,
      });
    });
  });
}

function priceFormatForKind(kind: ChartingMetricKind) {
  switch (kind) {
    case "eps":
      return { type: "price" as const, precision: 2, minMove: 0.01 };
    case "percent":
      return { type: "percent" as const, precision: 2, minMove: 0.01 };
    case "multiple":
    case "ratio":
      return { type: "price" as const, precision: 2, minMove: 0.01 };
    default:
      return { type: "price" as const, precision: 2, minMove: 0.01 };
  }
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

function chartWidthPx(el: HTMLElement): number {
  return Math.max(0, Math.floor(el.getBoundingClientRect().width));
}

type Props = {
  metricId: ChartingMetricId;
  /** Annual fundamentals rows (full history — component keeps last 7 with values). */
  points: ChartingSeriesPoint[];
  height?: number;
};

export function MultichartFundamentalsBar({ metricId, points, height = 196 }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  const kind = CHARTING_METRIC_KIND[metricId];
  const rows = useMemo(() => sliceLastAnnualWithMetric(points, metricId, 7), [points, metricId]);

  const tickLabels = useMemo(() => {
    const m = new Map<number, string>();
    rows.forEach((r, i) => {
      m.set(indexToBarSlotTime(i) as number, formatAnnualYearLabel(r.periodEnd));
    });
    return m;
  }, [rows]);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;

    if (chartRef.current) {
      chartRef.current.remove();
      chartRef.current = null;
    }

    if (rows.length === 0) return;

    let cancelled = false;
    let ro: ResizeObserver | null = null;

    const mount = () => {
      if (cancelled) return;
      if (chartWidthPx(el) < 2) {
        requestAnimationFrame(mount);
        return;
      }

      const histData = rows
        .map((r, i) => {
          const v = readChartingMetricValue(r, metricId);
          if (v == null) return null;
          return {
            time: indexToBarSlotTime(i),
            value: v,
            color: MULTICHART_BAR,
          };
        })
        .filter(Boolean) as { time: UTCTimestamp; value: number; color: string }[];

      if (histData.length === 0) return;

      const wPx = chartWidthPx(el);
      const chart = createChart(el, {
        width: wPx,
        height,
        autoSize: false,
        layout: {
          background: { type: ColorType.Solid, color: "#FFFFFF" },
          textColor: "#71717A",
          fontSize: 11,
          fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
          attributionLogo: false,
        },
        localization: {
          locale: "en-US",
          priceFormatter: (p: number) => formatAxisValue(kind, p),
        },
        grid: {
          vertLines: { visible: false },
          horzLines: { color: "#ECECEF", style: LineStyle.Solid },
        },
        leftPriceScale: {
          visible: true,
          borderVisible: false,
          minimumWidth: 52,
          textColor: "#71717A",
          scaleMargins: { top: 0.06, bottom: 0.14 },
        },
        rightPriceScale: { visible: false, borderVisible: false },
        timeScale: {
          borderVisible: false,
          rightOffset: 0,
          shiftVisibleRangeOnNewBar: false,
          /** Ticks at data points — avoids year labels shifting under the wrong bar. */
          uniformDistribution: false,
          tickMarkMaxCharacterLength: 5,
          barSpacing: MULTICHART_BAR_SPACING_PX,
          minBarSpacing: MULTICHART_BAR_SPACING_PX,
          maxBarSpacing: MULTICHART_BAR_SPACING_PX,
          enableConflation: false,
          fixLeftEdge: false,
          fixRightEdge: false,
          minimumHeight: 24,
          tickMarkFormatter: (time: Time) => {
            const n = timeToUnixSeconds(time);
            if (n == null) return "";
            return tickLabels.get(n) ?? "";
          },
        },
        crosshair: {
          mode: CrosshairMode.Normal,
          vertLine: {
            visible: false,
            width: 1,
            color: "rgba(9, 9, 11, 0.08)",
            style: LineStyle.Solid,
            labelVisible: false,
          },
          horzLine: {
            visible: true,
            width: 1,
            color: "rgba(9, 9, 11, 0.06)",
            style: LineStyle.Solid,
            labelVisible: false,
          },
        },
        handleScroll: {
          mouseWheel: false,
          pressedMouseMove: false,
          horzTouchDrag: false,
          vertTouchDrag: false,
        },
        handleScale: {
          mouseWheel: false,
          pinch: false,
          axisPressedMouseMove: { time: false, price: true },
          axisDoubleClickReset: { time: true, price: true },
        },
      });

      chartRef.current = chart;

      const series = chart.addSeries(HistogramSeries, {
        priceScaleId: "left",
        color: MULTICHART_BAR,
        priceFormat: priceFormatForKind(kind),
        lastValueVisible: false,
        priceLineVisible: false,
      });
      series.setData(histData);
      layoutMultichartTimeScale(chart, wPx);

      ro = new ResizeObserver(() => {
        const rw = el.clientWidth;
        if (rw > 0 && chartRef.current) {
          chartRef.current.resize(rw, height);
          layoutMultichartTimeScale(chartRef.current, rw);
        }
      });
      ro.observe(el);
    };

    mount();

    return () => {
      cancelled = true;
      ro?.disconnect();
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }
    };
  }, [rows, metricId, height, kind, tickLabels]);

  if (rows.length === 0) {
    return (
      <div className="px-[20px]">
        <div
          className="flex h-[196px] items-center justify-center rounded-lg border border-dashed border-[#E4E4E7] bg-[#FAFAFA] text-[13px] text-[#71717A]"
          aria-hidden
        >
          No data
        </div>
      </div>
    );
  }

  return (
    <div className="w-full min-w-0 px-[20px]">
      <div ref={wrapRef} className="h-full w-full min-w-0" style={{ height }} />
    </div>
  );
}
