"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  AreaSeries,
  ColorType,
  CrosshairMode,
  LastPriceAnimationMode,
  LineSeries,
  LineStyle,
  LineType,
  createChart,
  type IChartApi,
  type ISeriesApi,
  type MouseEventParams,
  type Time,
  type UTCTimestamp,
} from "lightweight-charts";

import { horzTimeToUnixSeconds, nearestPointByTime } from "@/components/chart/chart-selection-utils";
import {
  overviewChartAxisRowPx,
  CHART_PLOT_DOTS_PATTERN_CLASS,
  buildTwoSlotDayCrosshairLabelByBarTime,
  chartPointDisplayUnix,
  formatOverviewCrosshairBottomLabel,
  isTwoSlotDayOverviewRange,
  overviewAxisLabelsEqual,
  resolveOverviewBottomAxisMode,
  syncOverviewPeriodAxisLabels,
  periodAxisLabelLayoutStyle,
  periodAxisLabelMaxWidthClass,
  periodAxisLabelTransformClass,
  resolvePeriodAxisLabelAnchor,
  type OverviewAxisLabel,
  type OverviewBottomAxisMode,
  type PeriodAxisLabelAnchor,
} from "@/components/chart/overview-bottom-axis";
import type { CompanyPick } from "@/components/charting/company-picker";
import { isCryptoOverviewSymbol } from "@/lib/crypto/crypto-picker-universe";
import { ChartSkeleton } from "@/components/ui/chart-skeleton";
import {
  fitContentWithMobilePlotGutter,
  mobileOverviewChartScaleOptions,
  mobileTimeScaleOptions,
  shouldHideMobileYAxisLabels,
} from "@/lib/chart/mobile-plot-horizontal-gutter";
import { cn } from "@/lib/utils";
import type { StockChartPoint, StockChartRange } from "@/lib/market/stock-chart-types";

const PRIMARY_BLUE = "#2563EB";

/** Line colors for additional compare tickers (primary is blue area). */
export const STOCK_OVERVIEW_COMPARE_LINE_COLORS = [
  "#EA580C",
  "#CA8A04",
  "#9333EA",
  "#DB2777",
  "#0891B2",
  "#4F46E5",
  "#059669",
  "#BE123C",
  "#B45309",
  "#0F766E",
  "#7C3AED",
  "#C026D3",
] as const;

const TOOLTIP_MAX_W = 280;
const TOOLTIP_GAP_PX = 6;
const TOOLTIP_EDGE_PAD = 8;

function layoutPointTooltip(
  hover: { x: number; y: number },
  containerWidth: number,
  chartHeight: number,
  estimatedHeight: number,
): { left: number; top: number; transform: string } {
  const left = Math.min(
    Math.max(TOOLTIP_EDGE_PAD, hover.x + TOOLTIP_GAP_PX),
    Math.max(TOOLTIP_EDGE_PAD, containerWidth - TOOLTIP_MAX_W - TOOLTIP_EDGE_PAD),
  );
  const minTop = TOOLTIP_EDGE_PAD;
  const bottomLimit = chartHeight - TOOLTIP_EDGE_PAD;
  const placeAbove = hover.y >= estimatedHeight + TOOLTIP_GAP_PX + minTop;
  if (placeAbove) {
    return { left, top: hover.y - TOOLTIP_GAP_PX, transform: "translateY(-100%)" };
  }
  const top = Math.max(minTop, Math.min(hover.y + TOOLTIP_GAP_PX, bottomLimit - estimatedHeight));
  return { left, top, transform: "none" };
}

function isFiniteNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

function overviewCompareReturnChartUrl(symbol: string, range: StockChartRange): string {
  const sym = symbol.trim().toUpperCase();
  const q = `range=${encodeURIComponent(range)}&series=return`;
  if (isCryptoOverviewSymbol(sym)) {
    return `/api/crypto/${encodeURIComponent(sym)}/chart?${q}`;
  }
  return `/api/stocks/${encodeURIComponent(sym)}/chart?${q}`;
}

function formatReturnPctFromIndex(v: number): string {
  if (!Number.isFinite(v)) return "—";
  const r = v - 100;
  const sign = r > 0 ? "+" : r < 0 ? "−" : "";
  return `${sign}${Math.abs(r).toFixed(2)}%`;
}

function formatAxisReturn(n: number): string {
  if (!Number.isFinite(n)) return "0%";
  const rel = n - 100;
  const sign = rel > 0 ? "+" : rel < 0 ? "−" : "";
  return `${sign}${Math.abs(rel).toFixed(2)}%`;
}

const HIDE_NATIVE_Y_AXIS_TICK_LABELS = (priceValue: readonly number[]) => priceValue.map(() => "");

function compareChartTickmarksFormatter(containerWidthPx: number) {
  return shouldHideMobileYAxisLabels(containerWidthPx)
    ? HIDE_NATIVE_Y_AXIS_TICK_LABELS
    : (priceValue: readonly number[]) => priceValue.map((p) => formatAxisReturn(p));
}

type Props = {
  primaryTicker: string;
  comparePicks: readonly CompanyPick[];
  range: StockChartRange;
  height?: number;
};

export function StockCompareReturnChart({ primaryTicker, comparePicks, range, height = 320 }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const primarySeriesRef = useRef<ISeriesApi<"Area"> | null>(null);
  const compareSeriesRefs = useRef<ISeriesApi<"Line">[]>([]);
  const primaryPointsRef = useRef<StockChartPoint[]>([]);
  const comparePointsListRef = useRef<StockChartPoint[][]>([]);
  const comparePicksRef = useRef<readonly CompanyPick[]>(comparePicks);

  const [loading, setLoading] = useState(true);
  const [primaryPts, setPrimaryPts] = useState<StockChartPoint[]>([]);
  const [comparePtsList, setComparePtsList] = useState<StockChartPoint[][]>(() =>
    comparePicks.map(() => []),
  );
  const [ready, setReady] = useState(false);
  const [containerWidth, setContainerWidth] = useState(0);
  const [periodAxisLabels, setPeriodAxisLabels] = useState<OverviewAxisLabel[]>([]);
  const periodAxisLabelsRef = useRef<OverviewAxisLabel[]>([]);
  const [hoverAxisLabel, setHoverAxisLabel] = useState<{ leftPx: number; label: string } | null>(
    null,
  );
  const [hoverPoint, setHoverPoint] = useState<{ x: number; y: number } | null>(null);
  const [hoverLines, setHoverLines] = useState<{ label: string; color: string }[] | null>(null);

  const hoverTimeRef = useRef<Time | null>(null);
  const hoverAxisLabelStateRef = useRef<{ leftPx: number; label: string } | null>(null);
  const crosshairHoveredRef = useRef(false);
  const dataTimeZoneRef = useRef("America/New_York");
  const overviewBottomAxisModeRef = useRef<OverviewBottomAxisMode>("calendar");
  const twoSlotDayCrosshairLabelByBarTimeRef = useRef<Map<number, string> | null>(null);
  const containerWidthRef = useRef(0);
  const rangeRef = useRef(range);
  rangeRef.current = range;
  const loadingRef = useRef(loading);
  loadingRef.current = loading;

  const axisRowPx = overviewChartAxisRowPx(containerWidth);
  const plotHeight = Math.max(120, height - axisRowPx);

  const pSym = primaryTicker.trim().toUpperCase();
  const compareSlotsKey = useMemo(
    () => comparePicks.map((p) => p.symbol.trim().toUpperCase()).join("|"),
    [comparePicks],
  );

  const overviewBottomAxisMode = useMemo(
    () => resolveOverviewBottomAxisMode(range, primaryPts),
    [range, primaryPts],
  );

  useEffect(() => {
    overviewBottomAxisModeRef.current = overviewBottomAxisMode;
  }, [overviewBottomAxisMode]);

  const setPeriodAxisLabelsGuarded = (next: OverviewAxisLabel[]) => {
    if (overviewAxisLabelsEqual(periodAxisLabelsRef.current, next)) return;
    periodAxisLabelsRef.current = next;
    setPeriodAxisLabels(next);
  };

  const setHoverAxisLabelGuarded = (next: { leftPx: number; label: string } | null) => {
    const prev = hoverAxisLabelStateRef.current;
    if (prev == null && next == null) return;
    if (prev != null && next != null && prev.leftPx === next.leftPx && prev.label === next.label) return;
    hoverAxisLabelStateRef.current = next;
    setHoverAxisLabel(next);
  };

  useEffect(() => {
    primaryPointsRef.current = primaryPts;
  }, [primaryPts]);
  useEffect(() => {
    comparePointsListRef.current = comparePtsList;
  }, [comparePtsList]);
  useEffect(() => {
    comparePicksRef.current = comparePicks;
  }, [comparePicks]);

  useEffect(() => {
    if (!isTwoSlotDayOverviewRange(range) || primaryPts.length === 0) {
      twoSlotDayCrosshairLabelByBarTimeRef.current = null;
      return;
    }
    const tz =
      primaryPts.find((p) => typeof p.timeZone === "string" && p.timeZone.length > 0)?.timeZone ??
      "America/New_York";
    twoSlotDayCrosshairLabelByBarTimeRef.current = buildTwoSlotDayCrosshairLabelByBarTime(
      primaryPts,
      tz,
      range,
    );
  }, [range, primaryPts]);

  useEffect(() => {
    containerWidthRef.current = containerWidth;
  }, [containerWidth]);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    const hideMobileScale = shouldHideMobileYAxisLabels(containerWidth);
    chart.applyOptions({
      ...mobileOverviewChartScaleOptions(containerWidth),
      localization: {
        priceFormatter: formatAxisReturn,
        tickmarksPriceFormatter: compareChartTickmarksFormatter(containerWidth),
      },
    });
    const wrapEl = wrapRef.current;
    if (wrapEl) {
      chart.resize(Math.max(2, wrapEl.clientWidth), plotHeight);
    }
    primarySeriesRef.current?.applyOptions({ lastValueVisible: !hideMobileScale });
    for (const line of compareSeriesRefs.current) {
      line.applyOptions({ lastValueVisible: !hideMobileScale });
    }
    if (primaryPointsRef.current.some((p) => isFiniteNumber(p.time) && isFiniteNumber(p.value))) {
      fitContentWithMobilePlotGutter(chart, containerWidth, primaryPointsRef.current.length);
    }
  }, [containerWidth]);

  useEffect(() => {
    dataTimeZoneRef.current =
      primaryPts.find((p) => typeof p.timeZone === "string" && p.timeZone.length > 0)?.timeZone ??
      "America/New_York";
  }, [primaryPts]);

  useEffect(() => {
    if (loading) return;
    const c = chartRef.current;
    if (!c || hoverTimeRef.current != null || primaryPointsRef.current.length === 0) return;
    setPeriodAxisLabelsGuarded(
      syncOverviewPeriodAxisLabels(
        c,
        primaryPointsRef.current,
        dataTimeZoneRef.current,
        overviewBottomAxisMode,
        containerWidthRef.current,
      ),
    );
  }, [overviewBottomAxisMode, primaryPts, containerWidth, loading]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setContainerWidth(el.clientWidth));
    ro.observe(el);
    setContainerWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  useLayoutEffect(() => {
    setHoverAxisLabelGuarded(null);
    setHoverPoint(null);
    setHoverLines(null);
    hoverTimeRef.current = null;
    crosshairHoveredRef.current = false;
    setPeriodAxisLabelsGuarded([]);
  }, [pSym, compareSlotsKey, range]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setReady(false);
      setPeriodAxisLabelsGuarded([]);
      const syms = compareSlotsKey.split("|").filter((s) => s.length > 0);
      try {
        const [ra, ...rOthers] = await Promise.all([
          fetch(overviewCompareReturnChartUrl(pSym, range), { credentials: "include" }),
          ...syms.map((s) => fetch(overviewCompareReturnChartUrl(s, range), { credentials: "include" })),
        ]);
        const ja = ra.ok ? ((await ra.json()) as { points?: StockChartPoint[] }) : { points: [] };
        const rest: StockChartPoint[][] = [];
        for (const rb of rOthers) {
          const jb = rb.ok ? ((await rb.json()) as { points?: StockChartPoint[] }) : { points: [] };
          rest.push(Array.isArray(jb.points) ? jb.points : []);
        }
        if (cancelled) return;
        setPrimaryPts(Array.isArray(ja.points) ? ja.points : []);
        setComparePtsList(rest);
      } catch {
        if (!cancelled) {
          setPrimaryPts([]);
          setComparePtsList(syms.map(() => []));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
          requestAnimationFrame(() => setReady(true));
        }
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [pSym, compareSlotsKey, range]);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;

    const nCompare = compareSlotsKey.split("|").filter((s) => s.length > 0).length;

    const chart = createChart(el, {
      width: Math.max(2, el.clientWidth),
      height: plotHeight,
      autoSize: false,
      layout: {
        background: { type: ColorType.Solid, color: "#00000000" },
        textColor: "#71717A",
        fontSize: 11,
        fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif",
        attributionLogo: false,
      },
      grid: {
        vertLines: { visible: false },
        horzLines: { visible: false },
      },
      ...mobileOverviewChartScaleOptions(containerWidthRef.current),
      timeScale: {
        borderVisible: false,
        ...mobileTimeScaleOptions(containerWidthRef.current),
        ticksVisible: false,
        tickMarkFormatter: () => "",
        minimumHeight: 0,
      },
      crosshair: {
        mode: CrosshairMode.Magnet,
        vertLine: {
          color: "rgba(15, 15, 15, 0.28)",
          labelVisible: false,
          width: 1,
          style: LineStyle.Dashed,
        },
        horzLine: { visible: false, labelVisible: false },
      },
      localization: {
        priceFormatter: formatAxisReturn,
        tickmarksPriceFormatter: compareChartTickmarksFormatter(containerWidthRef.current),
      },
      handleScroll: false,
      handleScale: false,
    });

    const primarySeries = chart.addSeries(AreaSeries, {
      lineColor: PRIMARY_BLUE,
      topColor: "rgba(37, 99, 235, 0.20)",
      bottomColor: "rgba(37, 99, 235, 0.02)",
      lineWidth: 2,
      lineType: LineType.Curved,
      priceLineVisible: false,
      lastValueVisible: !shouldHideMobileYAxisLabels(containerWidthRef.current),
      lastPriceAnimation: LastPriceAnimationMode.OnDataUpdate,
      crosshairMarkerVisible: true,
      crosshairMarkerRadius: 5,
      crosshairMarkerBorderColor: "rgba(255,255,255,0.95)",
      crosshairMarkerBackgroundColor: PRIMARY_BLUE,
      crosshairMarkerBorderWidth: 2,
    });

    const lines: ISeriesApi<"Line">[] = [];
    for (let i = 0; i < nCompare; i++) {
      const color = STOCK_OVERVIEW_COMPARE_LINE_COLORS[i % STOCK_OVERVIEW_COMPARE_LINE_COLORS.length]!;
      lines.push(
        chart.addSeries(LineSeries, {
          color,
          lineWidth: 2,
          lineType: LineType.Curved,
          priceLineVisible: false,
          lastValueVisible: !shouldHideMobileYAxisLabels(containerWidthRef.current),
          lastPriceAnimation: LastPriceAnimationMode.OnDataUpdate,
          crosshairMarkerVisible: true,
          crosshairMarkerRadius: 5,
          crosshairMarkerBorderColor: "rgba(255,255,255,0.95)",
          crosshairMarkerBackgroundColor: color,
          crosshairMarkerBorderWidth: 2,
        }),
      );
    }

    chartRef.current = chart;
    primarySeriesRef.current = primarySeries;
    compareSeriesRefs.current = lines;

    const resyncPeriodAxisLabels = () => {
      if (loadingRef.current) return;
      const c = chartRef.current;
      if (!c || hoverTimeRef.current != null || primaryPointsRef.current.length === 0) return;
      setPeriodAxisLabelsGuarded(
        syncOverviewPeriodAxisLabels(
          c,
          primaryPointsRef.current,
          dataTimeZoneRef.current,
          overviewBottomAxisModeRef.current,
          containerWidthRef.current,
        ),
      );
    };

    const onCrosshairMove = (param: MouseEventParams) => {
      if (param.point === undefined || param.point.x < 0 || param.point.y < 0 || param.time === undefined) {
        const wasHovered = crosshairHoveredRef.current;
        crosshairHoveredRef.current = false;
        hoverTimeRef.current = null;
        setHoverPoint(null);
        setHoverLines(null);
        setHoverAxisLabelGuarded(null);
        if (wasHovered) resyncPeriodAxisLabels();
        return;
      }

      setHoverPoint({ x: param.point.x, y: param.point.y });

      const sec = horzTimeToUnixSeconds(param.time);
      const pa = primaryPointsRef.current;
      const na = sec != null && pa.length ? nearestPointByTime(pa, sec) : null;
      if (!na || !isFiniteNumber(na.time) || !isFiniteNumber(na.value)) {
        crosshairHoveredRef.current = false;
        hoverTimeRef.current = null;
        setHoverLines(null);
        setHoverAxisLabelGuarded(null);
        resyncPeriodAxisLabels();
        return;
      }

      crosshairHoveredRef.current = true;
      hoverTimeRef.current = param.time as Time;

      const activeRange = rangeRef.current;
      const axisMode = overviewBottomAxisModeRef.current;
      const tz = dataTimeZoneRef.current;
      const labelUnix = chartPointDisplayUnix(na, axisMode);
      const label = formatOverviewCrosshairBottomLabel(
        activeRange,
        axisMode,
        na,
        pa,
        tz,
        twoSlotDayCrosshairLabelByBarTimeRef.current,
        labelUnix,
      );
      const xCoord = chart.timeScale().timeToCoordinate(na.time as UTCTimestamp);
      if (xCoord != null && Number.isFinite(xCoord) && label) {
        setHoverAxisLabelGuarded({ leftPx: xCoord, label });
      } else {
        setHoverAxisLabelGuarded(null);
      }

      const picks = comparePicksRef.current;
      const lists = comparePointsListRef.current;
      const linesOut: { label: string; color: string }[] = [
        { label: `${pSym} ${formatReturnPctFromIndex(na.value)}`, color: PRIMARY_BLUE },
      ];
      for (let i = 0; i < picks.length; i++) {
        const pb = lists[i] ?? [];
        const nb = sec != null && pb.length ? nearestPointByTime(pb, sec) : null;
        const sym = picks[i]?.symbol.trim().toUpperCase() ?? "";
        const color = STOCK_OVERVIEW_COMPARE_LINE_COLORS[i % STOCK_OVERVIEW_COMPARE_LINE_COLORS.length]!;
        if (nb && isFiniteNumber(nb.value)) {
          linesOut.push({ label: `${sym} ${formatReturnPctFromIndex(nb.value)}`, color });
        }
      }
      setHoverLines(linesOut);
    };

    chart.subscribeCrosshairMove(onCrosshairMove);

    const ro = new ResizeObserver(() => {
      chart.resize(Math.max(2, el.clientWidth), plotHeight);
      const plotW = containerRef.current?.clientWidth ?? el.clientWidth;
      fitContentWithMobilePlotGutter(chart, plotW, primaryPointsRef.current.length);
      resyncPeriodAxisLabels();
    });
    ro.observe(el);
    chart.resize(Math.max(2, el.clientWidth), plotHeight);

    return () => {
      ro.disconnect();
      chart.unsubscribeCrosshairMove(onCrosshairMove);
      chart.remove();
      chartRef.current = null;
      primarySeriesRef.current = null;
      compareSeriesRefs.current = [];
    };
  }, [plotHeight, pSym, compareSlotsKey]);

  useEffect(() => {
    const chart = chartRef.current;
    const a = primarySeriesRef.current;
    const lines = compareSeriesRefs.current;
    const nCompare = compareSlotsKey.split("|").filter((s) => s.length > 0).length;
    if (!chart || !a || lines.length !== nCompare) return;

    const mapData = (pts: StockChartPoint[]) =>
      pts
        .filter((p) => isFiniteNumber(p.time) && isFiniteNumber(p.value))
        .map((p) => ({ time: p.time as UTCTimestamp, value: p.value }));

    a.setData(mapData(primaryPts));
    for (let i = 0; i < lines.length; i++) {
      lines[i]!.setData(mapData(comparePtsList[i] ?? []));
    }
    fitContentWithMobilePlotGutter(
      chart,
      containerRef.current?.clientWidth ?? 0,
      primaryPts.filter((p) => isFiniteNumber(p.time) && isFiniteNumber(p.value)).length,
    );
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (!loading && chartRef.current && hoverTimeRef.current == null) {
          setPeriodAxisLabelsGuarded(
            syncOverviewPeriodAxisLabels(
              chartRef.current,
              primaryPts,
              dataTimeZoneRef.current,
              overviewBottomAxisModeRef.current,
              containerWidthRef.current,
            ),
          );
        }
      });
    });
  }, [primaryPts, comparePtsList, compareSlotsKey, loading]);

  const tooltipEstHeight = useMemo(() => 28 + Math.max(1, hoverLines?.length ?? 2) * 22, [hoverLines?.length]);

  const tooltipPos = useMemo(() => {
    if (!hoverPoint || !hoverLines?.length || containerWidth <= 0) return null;
    return layoutPointTooltip(hoverPoint, containerWidth, plotHeight, tooltipEstHeight);
  }, [hoverPoint, hoverLines, containerWidth, plotHeight, tooltipEstHeight]);

  const empty = !loading && primaryPts.length === 0;

  const emptyMessage = useCallback(() => {
    if (primaryPts.length === 0) return `No return data for ${pSym} in this range.`;
    return "No return data for this range.";
  }, [primaryPts.length, pSym]);

  return (
    <div
      ref={containerRef}
      className="relative z-0 flex min-w-0 flex-col select-none"
      style={{ height }}
      onMouseLeave={() => {
        crosshairHoveredRef.current = false;
        hoverTimeRef.current = null;
        setHoverAxisLabelGuarded(null);
        const c = chartRef.current;
        if (c && primaryPointsRef.current.length > 0) {
          setPeriodAxisLabelsGuarded(
            syncOverviewPeriodAxisLabels(
              c,
              primaryPointsRef.current,
              dataTimeZoneRef.current,
              overviewBottomAxisModeRef.current,
              containerWidthRef.current,
            ),
          );
        }
      }}
    >
      <div className="relative min-h-0 min-w-0 flex-1" style={{ height: plotHeight }}>
        <div className="pointer-events-none absolute inset-0 z-0 max-md:bg-[#FAFAFA] bg-white" aria-hidden>
          <div className={CHART_PLOT_DOTS_PATTERN_CLASS} />
        </div>
        <div
          ref={wrapRef}
          className={cn(
            "absolute inset-0 z-10 transition-opacity duration-300 ease-out",
            loading || !ready ? "opacity-0" : "opacity-100",
          )}
        />
        {hoverPoint && ready && !loading ? (
          <div
            className="pointer-events-none absolute inset-y-0 right-0 z-[15] max-md:bg-[#FAFAFA]/55 bg-white/55"
            style={{ left: Math.max(0, hoverPoint.x) }}
            aria-hidden
          />
        ) : null}
        {hoverLines && hoverPoint && tooltipPos ? (
          <div
            className="pointer-events-none absolute z-30 min-w-[148px] rounded-lg border border-[#E4E4E7] bg-white px-3 py-2 shadow-[0px_1px_4px_0px_rgba(10,10,10,0.08),0px_1px_2px_0px_rgba(10,10,10,0.06)]"
            style={{
              left: tooltipPos.left,
              top: tooltipPos.top,
              transform: tooltipPos.transform,
            }}
            role="tooltip"
          >
            {hoverLines.map((line, i) => (
              <p
                key={`${line.label}-${i}`}
                className={cn(
                  "text-xs font-semibold tabular-nums",
                  i > 0 && "mt-0.5",
                )}
                style={{ color: line.color }}
              >
                {line.label}
              </p>
            ))}
          </div>
        ) : null}
        {loading ? (
          <div className="absolute inset-0 z-20 flex flex-col px-1 py-1">
            <ChartSkeleton fill variant="minimal" />
          </div>
        ) : null}
        {empty ? (
          <div className="absolute inset-0 z-20 flex items-center justify-center px-6 text-center text-[14px] text-[#71717A]">
            {emptyMessage()}
          </div>
        ) : null}
      </div>
      {!loading ? (
        <div
          className="relative w-full shrink-0 overflow-visible"
          style={{ height: axisRowPx }}
          aria-hidden={periodAxisLabels.length === 0 && !hoverAxisLabel}
        >
          {hoverAxisLabel ? (
            (() => {
              const leftmost = periodAxisLabels[0]?.leftPx ?? null;
              const anchor = resolvePeriodAxisLabelAnchor(hoverAxisLabel.leftPx, {
                isLeftmost: leftmost != null && hoverAxisLabel.leftPx <= leftmost + 4,
              });
              return (
            <span
              className={`absolute bottom-1 inline-block whitespace-nowrap font-['Inter'] text-[11px] font-medium tabular-nums leading-none text-[#0F0F0F] sm:text-[12px] ${periodAxisLabelMaxWidthClass(anchor)} ${periodAxisLabelTransformClass(anchor)}`}
              style={periodAxisLabelLayoutStyle(hoverAxisLabel.leftPx, anchor)}
            >
              {hoverAxisLabel.label}
            </span>
              );
            })()
          ) : (
            periodAxisLabels.map((lab, i) => {
              const anchor = resolvePeriodAxisLabelAnchor(lab.leftPx, { isLeftmost: i === 0 });
              return (
              <span
                key={lab.key}
                className={`absolute bottom-1 inline-block whitespace-nowrap font-['Inter'] text-[11px] font-normal tabular-nums leading-none text-[#71717A] sm:text-[12px] ${periodAxisLabelMaxWidthClass(anchor)} ${periodAxisLabelTransformClass(anchor)}`}
                style={periodAxisLabelLayoutStyle(lab.leftPx, anchor)}
              >
                {lab.label}
              </span>
              );
            })
          )}
        </div>
      ) : null}
    </div>
  );
}
