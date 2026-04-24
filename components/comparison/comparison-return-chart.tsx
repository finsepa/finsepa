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

import type { StockPerformance } from "@/lib/market/stock-performance-types";

const RETURN_WINDOWS = [
  { key: "ytd" as const, label: "YTD" },
  { key: "y1" as const, label: "1Y" },
  { key: "y5" as const, label: "5Y" },
  { key: "y10" as const, label: "10Y" },
  { key: "all" as const, label: "Max" },
] as const;

const GROUP_CENTER_SPACING_DAYS = 72;
const HALF_DAY_SEC = 12 * 60 * 60;
/** Match `EarningsEstimatesChart` bar cap and gutters for consistent density. */
const RETURN_CHART_MAX_BAR_WIDTH_PX = 32;
const RETURN_INTER_GROUP_GAP_PX = 24;
const RETURN_INTER_GROUP_REF_BAR_SPACING_PX = 12;
const BAR_PICK_THRESHOLD_PX = 120;
/** Match `ESTIMATES_TIME_SCALE_GUTTER_PX` in earnings estimates chart. */
const RETURN_TIME_SCALE_GUTTER_PX = 14;
/** Plot height — same as `ESTIMATES_CHART_PLOT_HEIGHT_PX` (Earnings → Estimates). */
const RETURN_CHART_PLOT_HEIGHT_PX = 272;
/** Space for period labels + series legend row — same as `ESTIMATES_CHART_AXIS_ROW_PX`. */
const RETURN_CHART_AXIS_ROW_PX = 64;
const RETURN_CHART_TOTAL_HEIGHT_PX = RETURN_CHART_PLOT_HEIGHT_PX + RETURN_CHART_AXIS_ROW_PX;
/** Same as `ESTIMATES_CHART_Y_AXIS_WIDTH_PX` so the label grid lines up with the histogram. */
const RETURN_CHART_Y_AXIS_WIDTH_PX = 56;

type HistogramDatum =
  | { time: UTCTimestamp; value: number; color: string }
  | { time: UTCTimestamp };

type BarMeta = { w: number; j: number; time: number };

function interGroupWhitespaceSlotCount(): number {
  return Math.max(1, Math.round(RETURN_INTER_GROUP_GAP_PX / RETURN_INTER_GROUP_REF_BAR_SPACING_PX));
}

function periodBaseTime(w: number): UTCTimestamp {
  const sec = Date.UTC(2018, 0, 1 + w * GROUP_CENTER_SPACING_DAYS) / 1000;
  return sec as UTCTimestamp;
}

function tickerShift(j: number, n: number): number {
  if (n <= 1) return 0;
  const mid = (n - 1) / 2;
  return (j - mid) * HALF_DAY_SEC;
}

function chartWidthPx(el: HTMLElement): number {
  return Math.max(0, Math.floor(el.getBoundingClientRect().width));
}

/** Fit histogram to plot width; snap logical indices 0 … n−1 so bars use the full time-scale pane. */
function layoutReturnTimeScale(
  chart: IChartApi,
  containerWidthPx: number,
  logicalPointCount: number,
  attempt = 0,
): void {
  if (logicalPointCount < 1) return;
  const ts = chart.timeScale();
  const lastIdx = logicalPointCount - 1;

  chart.resize(Math.max(1, containerWidthPx), RETURN_CHART_PLOT_HEIGHT_PX);
  ts.fitContent();

  requestAnimationFrame(() => {
    const plotW = ts.width();
    if (plotW < 12 && attempt < 14) {
      layoutReturnTimeScale(chart, containerWidthPx, logicalPointCount, attempt + 1);
      return;
    }
    if (plotW < 12) return;

    const span = logicalPointCount;
    const targetSpacing = Math.min(
      RETURN_CHART_MAX_BAR_WIDTH_PX,
      Math.max(3, (plotW - RETURN_TIME_SCALE_GUTTER_PX) / span),
    );
    ts.applyOptions({
      barSpacing: targetSpacing,
      minBarSpacing: 2,
      maxBarSpacing: RETURN_CHART_MAX_BAR_WIDTH_PX,
    });
    ts.setVisibleLogicalRange({ from: 0, to: lastIdx });

    requestAnimationFrame(() => {
      const plotW2 = ts.width() > 12 ? ts.width() : plotW;
      const refined = Math.min(
        RETURN_CHART_MAX_BAR_WIDTH_PX,
        Math.max(3, (plotW2 - RETURN_TIME_SCALE_GUTTER_PX) / span),
      );
      if (Math.abs(refined - targetSpacing) > 0.25) {
        ts.applyOptions({ barSpacing: refined, maxBarSpacing: RETURN_CHART_MAX_BAR_WIDTH_PX });
      }
      ts.setVisibleLogicalRange({ from: 0, to: lastIdx });
    });
  });
}

function formatReturnPct(v: number): string {
  if (!Number.isFinite(v)) return "—";
  const sign = v > 0 ? "+" : "";
  return `${sign}${v.toFixed(2)}%`;
}

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

function pickBarAtX(chart: IChartApi, cx: number, barMetas: BarMeta[]): BarMeta | null {
  let best: BarMeta | null = null;
  let bestDist = Infinity;
  for (const b of barMetas) {
    const coord = chart.timeScale().timeToCoordinate(b.time as UTCTimestamp);
    if (coord === null) continue;
    const d = Math.abs(coord - cx);
    if (d < bestDist) {
      bestDist = d;
      best = b;
    }
  }
  if (best == null || bestDist > BAR_PICK_THRESHOLD_PX) return null;
  return best;
}

function periodBandXRange(chart: IChartApi, w: number, barMetas: BarMeta[]): { x0: number; x1: number } | null {
  const ts = chart.timeScale();
  const half = ts.options().barSpacing / 2;
  const xs: number[] = [];
  for (const b of barMetas) {
    if (b.w !== w) continue;
    const c = ts.timeToCoordinate(b.time as UTCTimestamp);
    if (c != null) xs.push(c);
  }
  if (xs.length === 0) return null;
  return { x0: Math.min(...xs) - half, x1: Math.max(...xs) + half };
}

class ReturnHoverBandPrimitive implements IPanePrimitive {
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

type TooltipModel = {
  y: number;
  anchorX: number;
  side: "left" | "right";
  periodLabel: string;
  lines: { ticker: string; text: string; color: string }[];
};

export function ComparisonReturnChart({
  tickers,
  performances,
  colors,
}: {
  tickers: string[];
  performances: Record<string, StockPerformance | null | undefined>;
  colors: readonly string[];
}) {
  const [tooltip, setTooltip] = useState<TooltipModel | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const bandPrimitiveRef = useRef<ReturnHoverBandPrimitive | null>(null);

  const hasAnyBar = useMemo(() => {
    if (tickers.length === 0) return false;
    for (const t of tickers) {
      const p = performances[t];
      if (!p) continue;
      for (const w of RETURN_WINDOWS) {
        const v = p[w.key];
        if (v != null && Number.isFinite(v)) return true;
      }
    }
    return false;
  }, [tickers, performances]);

  const ariaSummary = useMemo(() => {
    const parts: string[] = [];
    for (const t of tickers) {
      const p = performances[t];
      if (!p) continue;
      const bits = RETURN_WINDOWS.map((w) => {
        const v = p[w.key];
        return `${w.label} ${v != null && Number.isFinite(v) ? formatReturnPct(v) : "—"}`;
      }).join(", ");
      parts.push(`${t}: ${bits}`);
    }
    return parts.join(" · ");
  }, [tickers, performances]);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el || tickers.length === 0 || !hasAnyBar) {
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
    const n = tickers.length;
    const gapSlots = interGroupWhitespaceSlotCount();

    const hasBar = (w: number, j: number): boolean => {
      const sym = tickers[j]!;
      const v = performances[sym]?.[RETURN_WINDOWS[w]!.key];
      return v != null && Number.isFinite(v);
    };

    const periodBounds = (w: number): { min: number; max: number } => {
      const base = periodBaseTime(w) as number;
      const times: number[] = [];
      for (let j = 0; j < n; j++) {
        if (!hasBar(w, j)) continue;
        times.push(base + tickerShift(j, n));
      }
      if (times.length === 0) return { min: base, max: base };
      return { min: Math.min(...times), max: Math.max(...times) };
    };

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

      const data: HistogramDatum[] = [];
      const barMetas: BarMeta[] = [];

      for (let w = 0; w < RETURN_WINDOWS.length; w++) {
        const base = periodBaseTime(w) as number;
        for (let j = 0; j < n; j++) {
          const sym = tickers[j]!;
          const v = performances[sym]?.[RETURN_WINDOWS[w]!.key];
          if (v == null || !Number.isFinite(v)) continue;
          const t = (base + tickerShift(j, n)) as UTCTimestamp;
          const color = colors[j] ?? "#2563EB";
          data.push({ time: t, value: v, color });
          barMetas.push({ w, j, time: t as number });
        }

        if (w >= RETURN_WINDOWS.length - 1) continue;
        const end = periodBounds(w).max;
        const start = periodBounds(w + 1).min;
        if (!Number.isFinite(end) || !Number.isFinite(start) || start <= end) continue;
        const span = start - end;
        for (let g = 0; g < gapSlots; g++) {
          data.push({ time: (end + ((g + 1) / (gapSlots + 1)) * span) as UTCTimestamp });
        }
      }

      data.sort((a, b) => (a.time as number) - (b.time as number));

      const bandPrimitive = new ReturnHoverBandPrimitive();
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
          priceFormatter: (p: number) => {
            if (!Number.isFinite(p)) return "";
            const sign = p > 0 ? "+" : p < 0 ? "" : "";
            return `${sign}${p.toFixed(2)}%`;
          },
        },
        grid: {
          vertLines: { visible: false },
          horzLines: { color: "#E4E4E7" },
        },
        leftPriceScale: { visible: false, borderVisible: false },
        rightPriceScale: {
          visible: true,
          borderVisible: false,
          minimumWidth: RETURN_CHART_Y_AXIS_WIDTH_PX,
          scaleMargins: { top: 0.08, bottom: 0.12 },
        },
        timeScale: {
          borderVisible: false,
          /** Native ticks omitted — period labels render in the DOM row below (same pattern as Earnings → Estimates). */
          visible: false,
          rightOffset: 0,
          shiftVisibleRangeOnNewBar: false,
          barSpacing: 12,
          minBarSpacing: 2,
          maxBarSpacing: RETURN_CHART_MAX_BAR_WIDTH_PX,
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
        color: "#2563EB",
        lastValueVisible: false,
        priceLineVisible: false,
        priceFormat: { type: "price", precision: 2, minMove: 0.01 },
      });

      chart.panes()[0]?.attachPrimitive(bandPrimitive);

      series.setData(data);
      chart.resize(wPx, RETURN_CHART_PLOT_HEIGHT_PX);
      layoutReturnTimeScale(chart, wPx, data.length);

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
          const picked = pickBarAtX(chart, param.point.x, barMetas);
          if (!picked) {
            bandPrimitive.setBand(null, null);
            setTooltip(null);
            return;
          }
          const band = periodBandXRange(chart, picked.w, barMetas);
          if (band) bandPrimitive.setBand(band.x0, band.x1);
          else bandPrimitive.setBand(null, null);

          const periodLabel = RETURN_WINDOWS[picked.w]!.label;
          const lines: TooltipModel["lines"] = [];
          for (let j = 0; j < n; j++) {
            const sym = tickers[j]!;
            const v = performances[sym]?.[RETURN_WINDOWS[picked.w]!.key];
            const color = colors[j] ?? "#2563EB";
            lines.push({
              ticker: sym,
              text: v != null && Number.isFinite(v) ? formatReturnPct(v) : "—",
              color,
            });
          }

          const cw = chartWidthPx(el);
          const { anchorX, side } = computeTooltipHorizontalPlacement(param.point.x, cw);
          setTooltip({
            y: param.point.y,
            anchorX,
            side,
            periodLabel,
            lines,
          });
        });
      };
      chart.subscribeCrosshairMove(onCrosshairMove);

      const logicalCount = data.length;
      ro = new ResizeObserver(() => {
        const w = chartWidthPx(el);
        if (w > 0 && chartRef.current) {
          layoutReturnTimeScale(chartRef.current, w, logicalCount);
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
  }, [tickers, performances, colors, hasAnyBar]);

  const showChart = tickers.length > 0 && hasAnyBar;

  return (
    <section className="w-full min-w-0 max-w-full overflow-x-hidden bg-white">
      <h3 className="mb-4 text-[18px] font-semibold leading-7 tracking-tight text-[#09090B]">Return</h3>

      <div>
        {tickers.length === 0 ? (
          <div
            className="flex items-center justify-center text-[14px] text-[#71717A]"
            style={{ height: RETURN_CHART_TOTAL_HEIGHT_PX }}
          >
            Add companies to compare returns.
          </div>
        ) : showChart ? (
          <div
            className="relative w-full min-w-0 max-w-full overflow-x-hidden"
            style={{ height: RETURN_CHART_TOTAL_HEIGHT_PX }}
            role="img"
            aria-label={`Return chart for ${tickers.join(", ")}`}
            title={ariaSummary}
            onPointerLeave={() => {
              bandPrimitiveRef.current?.setBand(null, null);
              setTooltip(null);
            }}
          >
            <div
              className="box-border flex w-full min-w-0 max-w-full flex-col overflow-x-hidden px-2 sm:px-3"
              style={{ height: RETURN_CHART_TOTAL_HEIGHT_PX }}
            >
              <div
                className="relative w-full min-w-0 shrink-0 overflow-hidden"
                style={{ height: RETURN_CHART_PLOT_HEIGHT_PX }}
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
                    <div className="mt-1.5 space-y-0.5">
                      {tooltip.lines.map((line) => (
                        <p
                          key={line.ticker}
                          className="flex items-center gap-2 whitespace-nowrap text-[12px] font-normal leading-4 text-[#71717A]"
                        >
                          <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: line.color }} />
                          <span>
                            {line.ticker}: {line.text}
                          </span>
                        </p>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
              <div
                className="flex w-full shrink-0 flex-col gap-4 border-t border-[#E4E4E7] pt-1.5"
                style={{ height: RETURN_CHART_AXIS_ROW_PX }}
              >
                <div className="flex min-h-0 w-full min-w-0 flex-1">
                  <div
                    className="grid min-w-0 flex-1"
                    style={{
                      gridTemplateColumns: `repeat(${RETURN_WINDOWS.length}, minmax(0, 1fr))`,
                    }}
                  >
                    {RETURN_WINDOWS.map((w) => (
                      <div key={w.key} className="min-w-0 px-0.5 text-center">
                        <span className="text-balance font-['Inter'] text-[11px] font-normal leading-snug text-[#71717A] sm:text-[12px]">
                          {w.label}
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="shrink-0" style={{ width: RETURN_CHART_Y_AXIS_WIDTH_PX }} aria-hidden />
                </div>
                <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-1">
                  {tickers.map((t, ti) => (
                    <div key={t} className="flex items-center gap-2">
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: colors[ti] ?? "#2563EB" }}
                      />
                      <span className="text-[13px] leading-5 text-[#71717A]">{t}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div
            className="flex items-center justify-center text-[14px] text-[#71717A]"
            style={{ height: RETURN_CHART_TOTAL_HEIGHT_PX }}
          >
            No return data for these companies.
          </div>
        )}
      </div>
    </section>
  );
}
