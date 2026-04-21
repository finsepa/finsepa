"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { CanvasRenderingTarget2D } from "fancy-canvas";
import {
  ColorType,
  CrosshairMode,
  HistogramSeries,
  LineStyle,
  createChart,
  type IChartApi,
  type IPanePrimitive,
  type IPanePrimitivePaneView,
  type IPrimitivePaneRenderer,
  type MouseEventParams,
  type PaneAttachedParameter,
  type UTCTimestamp,
} from "lightweight-charts";

import { SegmentedControl } from "@/components/design-system";
import { formatRatio, formatUsdCompact } from "@/lib/market/key-stats-basic-format";
import type { StockEarningsEstimatesChart, StockEarningsEstimatesPoint } from "@/lib/market/stock-earnings-types";

/** Charting tab reference — primary blue + translucent grouped bar. */
const REPORTED_BAR = "#2563EB";
const ESTIMATE_BAR = "rgba(37, 99, 235, 0.52)";
/** Half-day offset so estimate/actual bars stay paired; keep small vs {@link GROUP_CENTER_SPACING_DAYS}. */
const GROUP_SHIFT_SEC = 24 * 60 * 60;

/**
 * Synthetic days between fiscal **group centers**. Intra-pair bars stay ±12h apart; a larger D allocates
 * more of the fitted time range to gaps between years/quarters so clusters don’t visually run together.
 */
const GROUP_CENTER_SPACING_DAYS = 72;

/** Show at most the latest 10 fiscal years (annual) or 40 quarters (~10y quarterly), oldest → newest in source. */
const MAX_ANNUAL_BARS = 10;
const MAX_QUARTERLY_BARS = 40;

/** Plot height (px). Built-in time scale labels are hidden — fiscal periods render in the DOM row below. */
const ESTIMATES_CHART_PLOT_HEIGHT_PX = 272;
/** Space for fiscal period grid + horizontal estimate/reported legend (total chart block stays 320px). */
const ESTIMATES_CHART_AXIS_ROW_PX = 48;
const ESTIMATES_CHART_TOTAL_HEIGHT_PX = ESTIMATES_CHART_PLOT_HEIGHT_PX + ESTIMATES_CHART_AXIS_ROW_PX;

/** Must match `leftPriceScale.minimumWidth` so period labels line up with the histogram plot. */
const ESTIMATES_CHART_LEFT_PRICE_SCALE_PX = 56;

/** LWC time-scale `barSpacing` ≈ histogram column width (px); `maxBarSpacing` caps zoom/fit. */
const ESTIMATES_CHART_MAX_BAR_WIDTH_PX = 32;

/**
 * Target gap between fiscal **groups** (each pair: estimate + reported). Inserted as whitespace logical
 * slots (~{@link ESTIMATES_INTER_GROUP_GAP_PX}px when `barSpacing` is near the reference).
 */
const ESTIMATES_INTER_GROUP_GAP_PX = 24;
const ESTIMATES_INTER_GROUP_REF_BAR_SPACING_PX = 12;

type HistogramDatum =
  | { time: UTCTimestamp; value: number; color: string }
  | { time: UTCTimestamp };

function interGroupWhitespaceSlotCount(): number {
  return Math.max(1, Math.round(ESTIMATES_INTER_GROUP_GAP_PX / ESTIMATES_INTER_GROUP_REF_BAR_SPACING_PX));
}

function sliceLatestEstimatesPoints(
  points: StockEarningsEstimatesPoint[],
  mode: "annual" | "quarterly",
): StockEarningsEstimatesPoint[] {
  const cap = mode === "annual" ? MAX_ANNUAL_BARS : MAX_QUARTERLY_BARS;
  if (points.length <= cap) return points;
  return points.slice(-cap);
}

function formatAxisValue(p: number, metric: "revenue" | "earnings"): string {
  if (!Number.isFinite(p)) return "";
  if (metric === "earnings") {
    return p.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  }
  const abs = Math.abs(p);
  if (abs >= 1e9) return `${Math.round(p / 1e9)} B`;
  if (abs >= 1e6) return `${Math.round(p / 1e6)} M`;
  if (abs >= 1e3) return `${Math.round(p / 1e3)} K`;
  if (abs < 1e-9) return "0";
  return p.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

/** Chart hover copy: space before K/M/B/T (e.g. `$25.13 B`). */
function formatTooltipChartRevenue(v: number): string {
  return formatUsdCompact(v).replace(/(\$[\d,.]+)([KMBT])$/, "$1 $2");
}

/**
 * Vertical band drawn **behind** histogram bars via pane primitive {@link IPrimitivePaneRenderer.drawBackground}.
 */
class EstimatesHoverBandPrimitive implements IPanePrimitive {
  private _requestUpdate: (() => void) | null = null;
  private _x0: number | null = null;
  private _x1: number | null = null;

  setBand(x0: number | null, x1: number | null): void {
    if (this._x0 === x0 && this._x1 === x1) return;
    this._x0 = x0;
    this._x1 = x1;
    this._requestUpdate?.();
  }

  attached(param: PaneAttachedParameter): void {
    this._requestUpdate = param.requestUpdate;
  }

  detached(): void {
    this._requestUpdate = null;
  }

  paneViews(): readonly IPanePrimitivePaneView[] {
    return [this._paneView];
  }

  private readonly _paneView: IPanePrimitivePaneView = {
    zOrder: () => "bottom",
    renderer: () => this._renderer,
  };

  private readonly _renderer: IPrimitivePaneRenderer = {
    draw: () => {},
    drawBackground: (target: CanvasRenderingTarget2D) => {
      if (this._x0 == null || this._x1 == null) return;
      const left = Math.min(this._x0, this._x1);
      const right = Math.max(this._x0, this._x1);
      const w = right - left;
      if (!Number.isFinite(w) || w <= 0) return;
      target.useMediaCoordinateSpace(({ context, mediaSize }) => {
        context.fillStyle = "rgba(59, 130, 246, 0.14)";
        context.fillRect(left, 0, w, mediaSize.height);
      });
    },
  };
}

type Row = { label: string; estimate: number | null; actual: number | null };

function toChartRows(points: StockEarningsEstimatesPoint[], metric: "revenue" | "earnings"): Row[] {
  const out: Row[] = [];
  for (const p of points) {
    const estimate = metric === "revenue" ? p.revenueEstimateUsd : p.epsEstimate;
    const actual = metric === "revenue" ? p.revenueActualUsd : p.epsActual;
    const hasE = estimate != null && Number.isFinite(estimate);
    const hasA = actual != null && Number.isFinite(actual);
    if (!hasE && !hasA) continue;
    out.push({
      label: p.label,
      estimate: hasE ? estimate! : null,
      actual: hasA ? actual! : null,
    });
  }
  return out;
}

function indexToBaseTime(i: number): UTCTimestamp {
  const sec = Date.UTC(2018, 0, 1 + i * GROUP_CENTER_SPACING_DAYS) / 1000;
  return sec as UTCTimestamp;
}

function barTimeShift(which: "estimate" | "actual"): number {
  return which === "estimate" ? -GROUP_SHIFT_SEC / 2 : GROUP_SHIFT_SEC / 2;
}

/** Max horizontal distance from bar center to pointer to count as a hover hit. */
const BAR_PICK_THRESHOLD_PX = 120;

/** Horizontal padding (px) inside the plot when auto-fitting bar spacing. */
const ESTIMATES_TIME_SCALE_GUTTER_PX = 14;

/**
 * Left price scale + tick labels (“35 B”, etc.) — `timeScale().width()` is only the plot; container is full.
 */
const ESTIMATES_CHART_LEFT_SCALE_RESERVE_PX = 64;

/**
 * Fit histogram to the **container** width: auto `barSpacing` (capped at 32px) so the series fills the plot
 * without needing horizontal pan; clip overflow at the wrapper to avoid page scrollbars.
 */
function chartWidthPx(el: HTMLElement): number {
  return Math.max(0, Math.floor(el.getBoundingClientRect().width));
}

function layoutEstimatesTimeScale(chart: IChartApi, containerWidthPx: number, layoutAttempt = 0): void {
  const ts = chart.timeScale();
  const plotBudget = Math.max(120, containerWidthPx - ESTIMATES_CHART_LEFT_SCALE_RESERVE_PX);
  ts.fitContent();
  requestAnimationFrame(() => {
    const lr = ts.getVisibleLogicalRange();
    if (lr === null) return;
    const measuredPlot = ts.width();
    const plotW =
      measuredPlot > 8 ? Math.min(measuredPlot, plotBudget) : plotBudget;
    if (plotW < 16 && layoutAttempt < 4) {
      layoutEstimatesTimeScale(chart, containerWidthPx, layoutAttempt + 1);
      return;
    }
    if (plotW < 16) return;

    const logicalSpan = Math.max(1, lr.to - lr.from);
    const targetSpacing = Math.min(
      ESTIMATES_CHART_MAX_BAR_WIDTH_PX,
      Math.max(2, (plotW - ESTIMATES_TIME_SCALE_GUTTER_PX) / logicalSpan),
    );
    ts.applyOptions({
      barSpacing: targetSpacing,
      minBarSpacing: 2,
      maxBarSpacing: ESTIMATES_CHART_MAX_BAR_WIDTH_PX,
    });

    const contentPx = logicalSpan * targetSpacing;
    const extraPx = Math.max(0, plotW - contentPx - ESTIMATES_TIME_SCALE_GUTTER_PX);
    /** Split slack evenly left/right so the series is centered and the plot width is used symmetrically. */
    const padLogicalEachSide = extraPx / (2 * targetSpacing);
    ts.setVisibleLogicalRange({
      from: lr.from - padLogicalEachSide,
      to: lr.to + padLogicalEachSide,
    });

    requestAnimationFrame(() => {
      const lr2 = ts.getVisibleLogicalRange();
      if (lr2 === null) return;
      const plotW2 = ts.width() > 8 ? ts.width() : plotW;
      const span2 = Math.max(1, lr2.to - lr2.from);
      const refined = Math.min(
        ESTIMATES_CHART_MAX_BAR_WIDTH_PX,
        Math.max(2, (plotW2 - ESTIMATES_TIME_SCALE_GUTTER_PX) / span2),
      );
      if (Math.abs(refined - targetSpacing) > 0.5) {
        ts.applyOptions({ barSpacing: refined });
      }
      const contentPx2 = span2 * refined;
      const extraPx2 = Math.max(0, plotW2 - contentPx2 - ESTIMATES_TIME_SCALE_GUTTER_PX);
      const padLogicalEachSide2 = extraPx2 / (2 * refined);
      ts.setVisibleLogicalRange({
        from: lr2.from - padLogicalEachSide2,
        to: lr2.to + padLogicalEachSide2,
      });
    });
  });
}

function pickRowAtX(chart: IChartApi, cx: number, rows: Row[]): { row: Row; index: number } | null {
  let best: Row | null = null;
  let bestIdx = -1;
  let bestDist = Infinity;
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!;
    const base = indexToBaseTime(i) as number;
    const times: number[] = [];
    if (row.estimate != null) times.push(base + barTimeShift("estimate"));
    if (row.actual != null) times.push(base + barTimeShift("actual"));
    for (const tsec of times) {
      const coord = chart.timeScale().timeToCoordinate(tsec as UTCTimestamp);
      if (coord === null) continue;
      const d = Math.abs(coord - cx);
      if (d < bestDist) {
        bestDist = d;
        best = row;
        bestIdx = i;
      }
    }
  }
  if (best == null || bestIdx < 0 || bestDist > BAR_PICK_THRESHOLD_PX) return null;
  return { row: best, index: bestIdx };
}

/** Keep the hover tooltip inside the chart overlay; flip to the right of the crosshair only when the default (left) layout would clip. */
function computeTooltipHorizontalPlacement(
  crosshairX: number,
  containerWidthPx: number,
): { anchorX: number; side: "left" | "right" } {
  const pad = 8;
  const gap = 10;
  const estW = Math.min(280, Math.max(140, containerWidthPx - 2 * pad));

  if (crosshairX - gap - estW >= pad) {
    return { anchorX: crosshairX, side: "left" };
  }

  let anchorX = crosshairX;
  if (anchorX + gap + estW > containerWidthPx - pad) {
    anchorX = containerWidthPx - pad - gap - estW;
  }
  anchorX = Math.max(pad, anchorX);
  return { anchorX, side: "right" };
}

function rowHighlightXRange(chart: IChartApi, row: Row, index: number): { x0: number; x1: number } | null {
  const ts = chart.timeScale();
  const half = ts.options().barSpacing / 2;
  const base = indexToBaseTime(index) as number;
  const xs: number[] = [];
  if (row.estimate != null) {
    const c = ts.timeToCoordinate((base + barTimeShift("estimate")) as UTCTimestamp);
    if (c != null) xs.push(c);
  }
  if (row.actual != null) {
    const c = ts.timeToCoordinate((base + barTimeShift("actual")) as UTCTimestamp);
    if (c != null) xs.push(c);
  }
  if (xs.length === 0) return null;
  const min = Math.min(...xs);
  const max = Math.max(...xs);
  return { x0: min - half, x1: max + half };
}

type TooltipModel = {
  y: number;
  /** Horizontal anchor after flip/nudge so the box stays in-bounds. */
  anchorX: number;
  side: "left" | "right";
  periodLabel: string;
  estimateLine: string;
  actualLine: string;
};

type Props = {
  data: StockEarningsEstimatesChart;
};

export function EarningsEstimatesChart({ data }: Props) {
  const [period, setPeriod] = useState<"annual" | "quarterly">("annual");
  const [metric, setMetric] = useState<"revenue" | "earnings">("revenue");
  const [tooltip, setTooltip] = useState<TooltipModel | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const bandPrimitiveRef = useRef<EstimatesHoverBandPrimitive | null>(null);

  const rows = useMemo(() => {
    const pts = period === "annual" ? data.annual : data.quarterly;
    return toChartRows(sliceLatestEstimatesPoints(pts, period), metric);
  }, [data, period, metric]);

  const legendEstimate = metric === "revenue" ? "Estimated Revenue" : "Estimated EPS";
  const legendReported = metric === "revenue" ? "Reported Revenue" : "Reported EPS";

  useEffect(() => {
    const el = wrapRef.current;
    if (!el || rows.length === 0) {
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }
      bandPrimitiveRef.current = null;
      return;
    }

    let cancelled = false;
    let ro: ResizeObserver | null = null;
    let crosshairRaf = 0;

    const mount = () => {
      if (cancelled) return;
      if (chartWidthPx(el) < 2) {
        requestAnimationFrame(mount);
        return;
      }
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }

      const estData: HistogramDatum[] = [];
      const actData: HistogramDatum[] = [];
      const gapSlots = interGroupWhitespaceSlotCount();

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i]!;
        const base = indexToBaseTime(i) as number;
        const tEst = base + barTimeShift("estimate");
        const tAct = base + barTimeShift("actual");
        if (row.estimate != null) {
          estData.push({
            time: tEst as UTCTimestamp,
            value: row.estimate,
            color: ESTIMATE_BAR,
          });
        }
        if (row.actual != null) {
          actData.push({
            time: tAct as UTCTimestamp,
            value: row.actual,
            color: REPORTED_BAR,
          });
        }

        if (i >= rows.length - 1) continue;
        const next = rows[i + 1]!;
        const baseNext = indexToBaseTime(i + 1) as number;
        const nextEst = baseNext + barTimeShift("estimate");
        const nextAct = baseNext + barTimeShift("actual");
        let groupEnd = Number.NEGATIVE_INFINITY;
        if (row.estimate != null) groupEnd = Math.max(groupEnd, tEst);
        if (row.actual != null) groupEnd = Math.max(groupEnd, tAct);
        let nextGroupStart = Number.POSITIVE_INFINITY;
        if (next.estimate != null) nextGroupStart = Math.min(nextGroupStart, nextEst);
        if (next.actual != null) nextGroupStart = Math.min(nextGroupStart, nextAct);
        if (!Number.isFinite(groupEnd) || !Number.isFinite(nextGroupStart) || nextGroupStart <= groupEnd) {
          continue;
        }
        const span = nextGroupStart - groupEnd;
        for (let g = 0; g < gapSlots; g++) {
          const t = (groupEnd + ((g + 1) / (gapSlots + 1)) * span) as UTCTimestamp;
          estData.push({ time: t });
          actData.push({ time: t });
        }
      }

      const bandPrimitive = new EstimatesHoverBandPrimitive();
      bandPrimitiveRef.current = bandPrimitive;

      const wPx = chartWidthPx(el);
      const chart = createChart(el, {
        width: wPx,
        autoSize: false,
        layout: {
          background: { type: ColorType.Solid, color: "#FFFFFF" },
          textColor: "#71717A",
          fontSize: 12,
          fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
          attributionLogo: false,
        },
        localization: {
          locale: "en-US",
          priceFormatter: (p: number) => formatAxisValue(p, metric),
        },
        grid: {
          vertLines: { visible: false },
          horzLines: { color: "#E4E4E7" },
        },
        rightPriceScale: { visible: false, borderVisible: false },
        leftPriceScale: {
          visible: true,
          borderVisible: false,
          minimumWidth: ESTIMATES_CHART_LEFT_PRICE_SCALE_PX,
          scaleMargins: { top: 0.08, bottom: 0.12 },
        },
        timeScale: {
          borderVisible: false,
          /** Native ticks omit many fiscal groups when dense; we render one label per group below. */
          visible: false,
          rightOffset: 0,
          shiftVisibleRangeOnNewBar: false,
          /** Overridden by {@link layoutEstimatesTimeScale} after data load / resize. */
          barSpacing: 12,
          minBarSpacing: 2,
          maxBarSpacing: ESTIMATES_CHART_MAX_BAR_WIDTH_PX,
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
        /** No horizontal (or wheel) pan — chart is fit to width; avoids page/chart horizontal scrollbars. */
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

      const seriesCommon =
        metric === "earnings"
          ? {
              lastValueVisible: false,
              priceLineVisible: false,
              priceFormat: { type: "price" as const, precision: 2, minMove: 0.01 },
            }
          : {
              lastValueVisible: false,
              priceLineVisible: false,
              priceFormat: { type: "price" as const, precision: 4, minMove: 0.0001 },
            };
      const estSeries = chart.addSeries(HistogramSeries, {
        ...seriesCommon,
        color: ESTIMATE_BAR,
      });
      const actSeries = chart.addSeries(HistogramSeries, {
        ...seriesCommon,
        color: REPORTED_BAR,
      });

      chart.panes()[0]?.attachPrimitive(bandPrimitive);

      estSeries.setData(estData);
      actSeries.setData(actData);
      chart.resize(wPx, ESTIMATES_CHART_PLOT_HEIGHT_PX);
      layoutEstimatesTimeScale(chart, wPx);

      const onCrosshairMove = (param: MouseEventParams) => {
        if (crosshairRaf) cancelAnimationFrame(crosshairRaf);
        crosshairRaf = requestAnimationFrame(() => {
          crosshairRaf = 0;
          if (cancelled) return;
          if (!param.point || param.point.x < 0 || param.point.y < 0) {
            bandPrimitive.setBand(null, null);
            setTooltip(null);
            return;
          }
          const picked = pickRowAtX(chart, param.point.x, rows);
          if (!picked) {
            bandPrimitive.setBand(null, null);
            setTooltip(null);
            return;
          }
          const { row, index } = picked;
          const band = rowHighlightXRange(chart, row, index);
          if (band) bandPrimitive.setBand(band.x0, band.x1);
          else bandPrimitive.setBand(null, null);

          const estVal =
            row.estimate != null && Number.isFinite(row.estimate)
              ? metric === "revenue"
                ? formatTooltipChartRevenue(row.estimate)
                : formatRatio(row.estimate)
              : "—";
          const actVal =
            row.actual != null && Number.isFinite(row.actual)
              ? metric === "revenue"
                ? formatTooltipChartRevenue(row.actual)
                : formatRatio(row.actual)
              : "—";
          const cw = chartWidthPx(el);
          const { anchorX, side } = computeTooltipHorizontalPlacement(param.point.x, cw);
          setTooltip({
            y: param.point.y,
            anchorX,
            side,
            periodLabel: row.label,
            estimateLine: `${legendEstimate}: ${estVal}`,
            actualLine: `${legendReported}: ${actVal}`,
          });
        });
      };
      chart.subscribeCrosshairMove(onCrosshairMove);

      ro = new ResizeObserver(() => {
        const w = chartWidthPx(el);
        if (w > 0 && chartRef.current) {
          chartRef.current.resize(w, ESTIMATES_CHART_PLOT_HEIGHT_PX);
          layoutEstimatesTimeScale(chartRef.current, w);
        }
      });
      ro.observe(el);
    };

    mount();

    return () => {
      cancelled = true;
      if (crosshairRaf) cancelAnimationFrame(crosshairRaf);
      ro?.disconnect();
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }
      bandPrimitiveRef.current = null;
      setTooltip(null);
    };
  }, [rows, metric, legendEstimate, legendReported]);

  const showChart = rows.length > 0;

  return (
    <section className="w-full min-w-0 max-w-full overflow-x-hidden">
      <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="text-[18px] font-semibold leading-7 tracking-tight text-[#09090B]">Estimates</h3>
        <div className="flex flex-wrap items-center gap-3">
          <SegmentedControl
            aria-label="Statement period"
            options={[
              { value: "annual", label: "Annual" },
              { value: "quarterly", label: "Quarterly" },
            ]}
            value={period}
            onChange={setPeriod}
          />
          <SegmentedControl
            aria-label="Estimate metric"
            options={[
              { value: "revenue", label: "Revenue" },
              { value: "earnings", label: "EPS" },
            ]}
            value={metric}
            onChange={setMetric}
          />
        </div>
      </div>

      <div>
        {showChart ? (
          <div
            className="relative w-full min-w-0 max-w-full overflow-x-hidden"
            style={{ height: ESTIMATES_CHART_TOTAL_HEIGHT_PX }}
            onPointerLeave={() => {
              bandPrimitiveRef.current?.setBand(null, null);
              setTooltip(null);
            }}
          >
            {/*
              Horizontal inset via padding only — avoid `margin` + `width: calc(100% - …)` which can
              exceed 100% parent width and produce a horizontal scrollbar.
              Plot + fiscal period / series legend row = 320px total; crosshair y is relative to the plot pane only.
            */}
            <div
              className="box-border flex w-full min-w-0 max-w-full flex-col overflow-x-hidden px-2 sm:px-3"
              style={{ height: ESTIMATES_CHART_TOTAL_HEIGHT_PX }}
            >
              <div
                className="relative w-full min-w-0 shrink-0 overflow-hidden"
                style={{ height: ESTIMATES_CHART_PLOT_HEIGHT_PX }}
              >
                <div ref={wrapRef} className="h-full w-full min-w-0 overflow-hidden" />
                {tooltip ? (
                  <div
                    className="pointer-events-none absolute z-20 max-w-[min(280px,calc(100%-16px))] rounded-lg bg-[#09090B] px-3 py-2.5 pr-3.5 text-left text-white shadow-[0_10px_30px_rgba(0,0,0,0.25)]"
                    style={{
                      left: `clamp(8px, ${tooltip.anchorX}px, calc(100% - 8px))`,
                      top: tooltip.y,
                      transform:
                        tooltip.side === "left"
                          ? "translate(calc(-100% - 10px), -50%)"
                          : "translate(10px, -50%)",
                    }}
                  >
                    {tooltip.side === "left" ? (
                      <span
                        className="absolute top-1/2 left-full -translate-y-1/2 border-y-[6px] border-y-transparent border-l-[7px] border-l-[#09090B]"
                        aria-hidden
                      />
                    ) : (
                      <span
                        className="absolute top-1/2 right-full -translate-y-1/2 border-y-[6px] border-y-transparent border-r-[7px] border-r-[#09090B]"
                        aria-hidden
                      />
                    )}
                    <p className="text-[12px] font-semibold leading-4 text-white">{tooltip.periodLabel}</p>
                    <p className="mt-1.5 whitespace-nowrap text-[12px] font-normal leading-4 text-zinc-300">
                      {tooltip.estimateLine}
                    </p>
                    <p className="mt-0.5 whitespace-nowrap text-[12px] font-normal leading-4 text-zinc-300">
                      {tooltip.actualLine}
                    </p>
                  </div>
                ) : null}
              </div>
              <div
                className="flex w-full shrink-0 flex-col gap-2 border-t border-[#E4E4E7] pt-1.5"
                style={{ height: ESTIMATES_CHART_AXIS_ROW_PX }}
              >
                <div className="flex min-h-0 w-full min-w-0 flex-1">
                  <div className="shrink-0" style={{ width: ESTIMATES_CHART_LEFT_PRICE_SCALE_PX }} aria-hidden />
                  <div
                    className="grid min-w-0 flex-1"
                    style={{
                      gridTemplateColumns: rows.length ? `repeat(${rows.length}, minmax(0, 1fr))` : undefined,
                    }}
                  >
                    {rows.map((row, i) => (
                      <div key={`${row.label}-${i}`} className="min-w-0 px-0.5 text-center">
                        <span className="text-balance font-['Inter'] text-[11px] font-normal leading-snug text-[#71717A] sm:text-[12px]">
                          {row.label}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-1">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: ESTIMATE_BAR }} />
                    <span className="text-[13px] leading-5 text-[#71717A]">{legendEstimate}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: REPORTED_BAR }} />
                    <span className="text-[13px] leading-5 text-[#71717A]">{legendReported}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div
            className="flex items-center justify-center text-[14px] text-[#71717A]"
            style={{ height: ESTIMATES_CHART_TOTAL_HEIGHT_PX }}
          >
            No estimate data for this view.
          </div>
        )}
      </div>
    </section>
  );
}
