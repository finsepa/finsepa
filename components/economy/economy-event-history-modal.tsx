"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState, type CSSProperties, type MouseEvent } from "react";
import { AppModalOverlay } from "@/components/ui/app-modal-overlay";
import { AppModalShell } from "@/components/ui/app-modal-shell";
import { Spinner } from "@/components/ui/spinner";

import { CHART_PLOT_DOTS_PATTERN_CLASS } from "@/components/chart/overview-bottom-axis";
import {
  computeFundamentalsChartTooltipPlacement,
  FUNDAMENTALS_CHART_AXIS_LABEL_ROTATE_DEG,
  FUNDAMENTALS_CHART_AXIS_ROW_PX,
  FUNDAMENTALS_CHART_HOVER_BAND_BG,
  FUNDAMENTALS_CHART_PLOT_INSET_BOTTOM_FRAC,
  FUNDAMENTALS_CHART_PLOT_INSET_TOP_FRAC,
  FUNDAMENTALS_CHART_TOOLTIP_CLASS,
  FUNDAMENTALS_CHART_Y_AXIS_PADDING_CLASS,
  FUNDAMENTALS_CHART_Y_AXIS_W_PX,
  FUNDAMENTALS_CHART_ZERO_BASELINE_BORDER,
  valueToPlotBandTopPercent,
} from "@/lib/chart/fundamentals-chart-surface";
import { fundamentalsBarStaggerDelaySec } from "@/lib/chart/fundamentals-bar-enter-animation";
import { fundamentalsBarColorAtIndex, fundamentalsBarSolidAtIndex } from "@/lib/colors/fundamentals-multi-bar-colors";
import { formatEconomyMetric } from "@/lib/market/economy-format-display";
import {
  buildEconomyHistoryYAxisDomain,
  formatEconomyChartAxisTick,
} from "@/lib/market/economy-chart-axis";
import type { EconomyCalendarEvent } from "@/lib/market/economy-calendar-types";
import { cn } from "@/lib/utils";

type HistoryPoint = {
  date: string;
  period: string | null;
  actual: number | null;
  estimate: number | null;
  previous: number | null;
};

const NEGATIVE_BAR_COLOR = "#DC2626";
const BAR_HOVER_DIM_OPACITY = 0.6;
const CHART_PLOT_HEIGHT_PX = 320;
const CHART_TOTAL_HEIGHT_PX = CHART_PLOT_HEIGHT_PX + FUNDAMENTALS_CHART_AXIS_ROW_PX;
const BAR_WIDTH_PX = 14;
const POSITIVE_BAR_COLOR = fundamentalsBarSolidAtIndex(0);

/** Matches {@link StockIncomeStatementTable} / screener numeric cells. */
const historyTableGrid =
  "grid grid-cols-[minmax(11rem,2fr)_repeat(3,minmax(5.25rem,1fr))] gap-x-2";
const historyLabelHeaderClass =
  "flex min-h-full min-w-0 items-center self-stretch border-r border-[#E4E4E7] pr-4 text-left font-['Inter'] text-[12px] font-medium leading-5 text-[#71717A] sm:text-[14px]";
const historyValueHeaderClass =
  "flex min-h-full min-w-0 items-center justify-end self-stretch font-['Inter'] text-[12px] font-medium leading-5 text-[#71717A] sm:text-[14px]";
const historyNumCellClass =
  "min-w-0 w-full text-right font-['Inter'] text-[14px] font-normal leading-5 tabular-nums text-[#09090B]";
const historyLabelCellClass =
  "flex min-h-full min-w-0 items-center self-stretch border-r border-[#E4E4E7] pr-4 text-left font-['Inter'] text-[14px] font-normal leading-5 text-[#09090B]";

function formatPeriodLabel(dateStr: string, period: string | null): string {
  const d = new Date(dateStr.includes("T") ? dateStr : `${dateStr.split(" ")[0]}T12:00:00Z`);
  if (!Number.isFinite(d.getTime())) return dateStr;
  const monthYear = d.toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
  if (period) return `${period} (${monthYear})`;
  return monthYear;
}

function formatAxisLabel(dateStr: string, period: string | null): string {
  const d = new Date(dateStr.includes("T") ? dateStr : `${dateStr.split(" ")[0]}T12:00:00Z`);
  if (!Number.isFinite(d.getTime())) return dateStr.slice(0, 7);
  if (period) {
    const yy = String(d.getUTCFullYear()).slice(2);
    return `${period} '${yy}`;
  }
  return d.toLocaleDateString("en-US", { month: "short", year: "2-digit", timeZone: "UTC" });
}

function resolveBarFillColor(baseColor: string, dimmed: boolean): string {
  if (!dimmed) return baseColor;
  if (baseColor === NEGATIVE_BAR_COLOR) {
    return `rgba(220, 38, 38, ${BAR_HOVER_DIM_OPACITY})`;
  }
  return fundamentalsBarColorAtIndex(0, BAR_HOVER_DIM_OPACITY);
}

type ChartColumn = {
  value: number;
  label: string;
  axisLabel: string;
  leftPct: number;
};

function periodCenterLeftPercent(i: number, n: number): number {
  if (n <= 0) return 50;
  if (n === 1) return 50;
  return ((i + 0.5) / n) * 100;
}

type TipState = {
  anchorX: number;
  y: number;
  side: "left" | "right";
  periodLabel: string;
  valueLine: string;
  dotColor: string;
};

function EconomyHistoryBarChart({
  points,
  eventLabel,
}: {
  points: HistoryPoint[];
  eventLabel: string;
}) {
  const plotRef = useRef<HTMLDivElement>(null);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [tip, setTip] = useState<TipState | null>(null);

  const columns = useMemo((): ChartColumn[] => {
    const items: Omit<ChartColumn, "leftPct">[] = [];
    for (const pt of points) {
      const v = pt.actual ?? pt.previous;
      if (v == null || !Number.isFinite(v)) continue;
      items.push({
        value: v,
        label: formatPeriodLabel(pt.date, pt.period),
        axisLabel: formatAxisLabel(pt.date, pt.period),
      });
    }
    const n = items.length;
    return items.map((item, i) => ({
      ...item,
      leftPct: periodCenterLeftPercent(i, n),
    }));
  }, [points]);

  const values = useMemo(() => columns.map((c) => c.value), [columns]);
  const yDomain = useMemo(() => buildEconomyHistoryYAxisDomain(values), [values]);
  const yMin = yDomain.min;
  const yMax = yDomain.max;
  const yTicks = yDomain.ticks;
  const yBipolar = yDomain.bipolar;

  const plotInsetTop = `${FUNDAMENTALS_CHART_PLOT_INSET_TOP_FRAC * 100}%`;
  const plotInsetBottom = `${FUNDAMENTALS_CHART_PLOT_INSET_BOTTOM_FRAC * 100}%`;
  const n = columns.length;
  const shouldAnimateBars = n > 0;
  const barStaggerDelaySec = fundamentalsBarStaggerDelaySec(n);

  const clearHover = () => {
    setHoveredIndex(null);
    setTip(null);
  };

  const handleColumnHover = (e: MouseEvent<HTMLElement>, i: number, col: ChartColumn) => {
    const plot = plotRef.current;
    if (!plot) return;
    const plotR = plot.getBoundingClientRect();
    const { anchorX, side } = computeFundamentalsChartTooltipPlacement(
      e.clientX - plotR.left,
      Math.max(1, Math.floor(plotR.width)),
    );
    const fill = col.value < 0 ? NEGATIVE_BAR_COLOR : POSITIVE_BAR_COLOR;
    setHoveredIndex(i);
    setTip({
      anchorX,
      y: e.clientY - plotR.top,
      side,
      periodLabel: col.label,
      valueLine: formatEconomyMetric(col.value),
      dotColor: fill,
    });
  };

  if (n === 0) {
    return (
      <div
        className="flex items-center justify-center rounded-xl border border-dashed border-[#E4E4E7] bg-[#FAFAFA] text-[13px] text-[#71717A]"
        style={{ height: CHART_TOTAL_HEIGHT_PX }}
      >
        No data
      </div>
    );
  }

  return (
    <div className="w-full min-w-0 max-w-full overflow-hidden">
      <div
        className="relative flex w-full min-w-0 max-w-full flex-col overflow-hidden"
        style={{ height: CHART_TOTAL_HEIGHT_PX }}
      >
        <div className="flex min-h-0 w-full min-w-0 flex-1" style={{ height: CHART_PLOT_HEIGHT_PX }}>
          <div
            ref={plotRef}
            className="relative min-h-0 min-w-0 flex-1 overflow-hidden"
            onPointerLeave={clearHover}
          >
            <div
              className="pointer-events-none absolute inset-x-0 z-0 bg-white"
              style={{ top: plotInsetTop, bottom: plotInsetBottom }}
              aria-hidden
            >
              <div className={CHART_PLOT_DOTS_PATTERN_CLASS} />
              <div
                className="absolute inset-x-0 border-t"
                style={{
                  borderColor: FUNDAMENTALS_CHART_ZERO_BASELINE_BORDER,
                  top: yBipolar ? `${valueToPlotBandTopPercent(0, yMin, yMax)}%` : undefined,
                  bottom: yBipolar ? undefined : 0,
                }}
                aria-hidden
              />
            </div>

            <div
              className="absolute inset-x-0 z-[1] min-h-0 w-full min-w-0"
              style={{ top: plotInsetTop, bottom: plotInsetBottom }}
            >
              {columns.map((col, i) => {
                const v = col.value;
                const zeroTop = valueToPlotBandTopPercent(0, yMin, yMax);
                const vTop = valueToPlotBandTopPercent(v, yMin, yMax);
                const barHeightPct = v >= 0 ? Math.max(0, zeroTop - vTop) : Math.max(0, vTop - zeroTop);
                const barTopPct = v >= 0 ? vTop : zeroTop;
                const baseBarColor = v < 0 ? NEGATIVE_BAR_COLOR : POSITIVE_BAR_COLOR;
                const barColor = resolveBarFillColor(
                  baseBarColor,
                  hoveredIndex != null && hoveredIndex !== i,
                );

                return (
                  <div
                    key={`${col.axisLabel}-${i}`}
                    className="absolute top-0 z-0 h-full min-h-0 -translate-x-1/2"
                    style={{ left: `${col.leftPct}%`, width: BAR_WIDTH_PX + 12 }}
                    onMouseEnter={(e) => handleColumnHover(e, i, col)}
                    onMouseMove={(e) => handleColumnHover(e, i, col)}
                  >
                    {hoveredIndex === i ? (
                      <div
                        className="pointer-events-none absolute inset-x-0 top-0 z-0 h-full"
                        style={{ backgroundColor: FUNDAMENTALS_CHART_HOVER_BAND_BG }}
                        aria-hidden
                      />
                    ) : null}
                    {barHeightPct > 0 ? (
                      <div
                        className={cn(
                          "absolute left-1/2 z-10 -translate-x-1/2",
                          v >= 0 ? "rounded-t-[4px] rounded-b-none" : "rounded-b-[4px] rounded-t-none",
                          shouldAnimateBars ? "fundamentals-bar-grow-in" : "transition-[height,top] duration-75",
                        )}
                        style={{
                          ...(shouldAnimateBars
                            ? ({
                                ["--bar-grow-origin-top"]: `${zeroTop}%`,
                                ["--bar-target-height"]: `${barHeightPct}%`,
                                ["--bar-target-top"]: `${barTopPct}%`,
                                animationDelay: `${i * barStaggerDelaySec}s`,
                              } as CSSProperties)
                            : {
                                top: `${barTopPct}%`,
                                height: `${barHeightPct}%`,
                                minHeight: 2,
                              }),
                          width: BAR_WIDTH_PX,
                          maxWidth: "100%",
                          backgroundColor: barColor,
                        }}
                      />
                    ) : null}
                  </div>
                );
              })}
            </div>

            {tip ? (
              <div
                className={FUNDAMENTALS_CHART_TOOLTIP_CLASS}
                style={{
                  left: `clamp(8px, ${tip.anchorX}px, calc(100% - 8px))`,
                  top: tip.y,
                  transform:
                    tip.side === "left"
                      ? "translate(calc(-100% - 10px), -50%)"
                      : "translate(10px, -50%)",
                }}
                role="tooltip"
                aria-label="Chart tooltip"
              >
                {tip.side === "left" ? (
                  <span className="absolute top-1/2 left-full -translate-y-1/2" aria-hidden>
                    <span className="block border-y-[7px] border-y-transparent border-l-[8px] border-l-[#E4E4E7]" />
                    <span className="absolute top-1/2 left-px -translate-y-1/2 border-y-[6px] border-y-transparent border-l-[7px] border-l-white" />
                  </span>
                ) : (
                  <span className="absolute top-1/2 right-full -translate-y-1/2" aria-hidden>
                    <span className="block border-y-[7px] border-y-transparent border-r-[8px] border-r-[#E4E4E7]" />
                    <span className="absolute top-1/2 right-px -translate-y-1/2 border-y-[6px] border-y-transparent border-r-[7px] border-r-white" />
                  </span>
                )}
                <p className="text-[12px] font-semibold leading-4 text-[#09090B]">{tip.periodLabel}</p>
                <p className="mt-1.5 flex items-center gap-2 whitespace-nowrap text-[12px] font-normal leading-4 text-[#71717A]">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: tip.dotColor }}
                    aria-hidden
                  />
                  <span>
                    {eventLabel}: {tip.valueLine}
                  </span>
                </p>
              </div>
            ) : null}
          </div>

          <div
            className={cn(
              "relative h-full shrink-0 text-right font-['Inter'] text-[12px] tabular-nums leading-none text-[#71717A]",
              FUNDAMENTALS_CHART_Y_AXIS_PADDING_CLASS,
            )}
            style={{ width: FUNDAMENTALS_CHART_Y_AXIS_W_PX }}
            aria-hidden
          >
            <div
              className="pointer-events-none absolute inset-x-0"
              style={{ top: plotInsetTop, bottom: plotInsetBottom }}
            >
              {yTicks.map((t, i) => (
                <span
                  key={i}
                  className="absolute right-0 z-[1] block -translate-y-1/2 rounded-sm bg-white px-1 py-px"
                  style={{ top: `${valueToPlotBandTopPercent(t, yMin, yMax)}%` }}
                >
                  {formatEconomyChartAxisTick(t, yMax)}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div
          className="relative flex w-full min-w-0 shrink-0 overflow-visible"
          style={{ height: FUNDAMENTALS_CHART_AXIS_ROW_PX }}
          role="img"
          aria-label={`${eventLabel} bar chart`}
        >
          <div className="relative min-h-0 min-w-0 flex-1 overflow-visible">
            {columns.map((col, i) => {
              const show = n <= 24 || i % Math.ceil(n / 24) === 0 || i === n - 1;
              return (
                <div
                  key={`axis-${col.axisLabel}-${i}`}
                  className="absolute bottom-0 flex min-h-0 -translate-x-1/2 items-end justify-center overflow-visible px-0.5 pb-0.5"
                  style={{ left: `${col.leftPct}%`, width: BAR_WIDTH_PX + 12 }}
                  title={col.label}
                >
                  {show ? (
                    <span
                      className="inline-block whitespace-nowrap font-['Inter'] text-[11px] font-normal tabular-nums leading-none text-[#71717A] sm:text-[12px]"
                      style={{
                        transform: `rotate(${FUNDAMENTALS_CHART_AXIS_LABEL_ROTATE_DEG}deg)`,
                        transformOrigin: "center bottom",
                      }}
                    >
                      {col.axisLabel}
                    </span>
                  ) : null}
                </div>
              );
            })}
          </div>
          <div
            className="shrink-0"
            style={{ width: FUNDAMENTALS_CHART_Y_AXIS_W_PX }}
            aria-hidden
          />
        </div>
      </div>
    </div>
  );
}

export function EconomyEventHistoryModal({
  open,
  onClose,
  event,
  country,
}: {
  open: boolean;
  onClose: () => void;
  event: EconomyCalendarEvent;
  country: string;
}) {
  const titleId = useId();

  const [points, setPoints] = useState<HistoryPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const eventLabel = useMemo(() => {
    let t = event.type;
    const c = (event.comparison ?? "").toLowerCase();
    if (c === "yoy") t += " YoY";
    else if (c === "mom") t += " MoM";
    else if (c === "qoq") t += " QoQ";
    return t;
  }, [event.type, event.comparison]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setPoints([]);

    const params = new URLSearchParams({ type: event.type, country });
    if (event.comparison) params.set("comparison", event.comparison);

    fetch(`/api/economy/history?${params.toString()}`, { credentials: "include" })
      .then(async (res) => {
        if (!res.ok) throw new Error("Failed to load");
        return res.json();
      })
      .then((json: { points?: HistoryPoint[] }) => {
        if (cancelled) return;
        setPoints(Array.isArray(json.points) ? json.points : []);
      })
      .catch(() => {
        if (!cancelled) setError("Could not load historical data");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [open, event.type, event.comparison, country]);

  const onKeyDown = useCallback(
    (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); },
    [onClose],
  );

  useEffect(() => {
    if (!open) return;
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onKeyDown]);

  if (!open) return null;

  const latestActual = points.length > 0 ? points[points.length - 1]! : null;

  return (
    <AppModalOverlay open={open} onClose={onClose} zIndex={300}>
      <AppModalShell
        titleId={titleId}
        title={eventLabel}
        onClose={onClose}
        maxWidthClass="w-full max-w-[min(960px,calc(100vw-2rem))]"
        maxHeightClass="max-h-[min(92vh,720px)]"
        bodyScroll={false}
        headerClassName="px-5 py-4"
        bodyClassName="flex min-h-0 flex-1 flex-col overflow-hidden p-0"
        cardClassName="overflow-hidden"
      >
        {latestActual ? (
          <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-[#E4E4E7] px-5 pt-5 pb-3">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline gap-x-3 text-[13px] leading-5 text-[#71717A]">
                {latestActual.actual != null && (
                  <span>
                    Actual:{" "}
                    <span className="font-medium text-[#09090B]">
                      {formatEconomyMetric(latestActual.actual)}
                    </span>
                  </span>
                )}
                {latestActual.estimate != null && (
                  <span>
                    Forecast:{" "}
                    <span className="font-medium text-[#09090B]">
                      {formatEconomyMetric(latestActual.estimate)}
                    </span>
                  </span>
                )}
                {latestActual.previous != null && (
                  <span>
                    Prior:{" "}
                    <span className="font-medium text-[#09090B]">
                      {formatEconomyMetric(latestActual.previous)}
                    </span>
                  </span>
                )}
              </div>
            </div>
          </div>
        ) : null}
        <div className="min-h-0 flex-1 overflow-hidden px-5 py-4">
          {loading ? (
            <div
              className="flex items-center justify-center"
              style={{ height: CHART_TOTAL_HEIGHT_PX }}
              role="status"
              aria-live="polite"
              aria-label="Loading historical data"
            >
              <Spinner className="size-6 text-[#71717A]" />
            </div>
          ) : error ? (
            <div
              className="flex items-center justify-center text-[14px] text-[#71717A]"
              style={{ height: CHART_TOTAL_HEIGHT_PX }}
            >
              {error}
            </div>
          ) : points.length === 0 ? (
            <div
              className="flex items-center justify-center text-[14px] text-[#71717A]"
              style={{ height: CHART_TOTAL_HEIGHT_PX }}
            >
              No historical data available
            </div>
          ) : (
            <EconomyHistoryBarChart key={event.id} points={points} eventLabel={eventLabel} />
          )}
        </div>

        {!loading && points.length > 0 && (
          <div className="max-h-[280px] shrink-0 overflow-y-auto border-t border-[#E4E4E7]">
            <div className="divide-y divide-[#E4E4E7] bg-white">
              <div
                className={`${historyTableGrid} sticky top-0 z-10 min-h-[44px] items-stretch border-b border-[#E4E4E7] bg-white px-4 py-0`}
              >
                <div className={historyLabelHeaderClass}>Date</div>
                <div className={historyValueHeaderClass}>Actual</div>
                <div className={historyValueHeaderClass}>Forecast</div>
                <div className={historyValueHeaderClass}>Prior</div>
              </div>
              {[...points].reverse().map((pt, i) => (
                <div
                  key={`${pt.date}-${i}`}
                  className={`${historyTableGrid} group min-h-[60px] max-h-[60px] items-stretch bg-white px-4 transition-colors duration-75 hover:bg-neutral-50`}
                >
                  <div className={historyLabelCellClass}>
                    <span className="truncate">{formatPeriodLabel(pt.date, pt.period)}</span>
                  </div>
                  <div className={cn(historyNumCellClass, "flex min-h-full items-center justify-end")}>
                    {formatEconomyMetric(pt.actual)}
                  </div>
                  <div className={cn(historyNumCellClass, "flex min-h-full items-center justify-end")}>
                    {formatEconomyMetric(pt.estimate)}
                  </div>
                  <div className={cn(historyNumCellClass, "flex min-h-full items-center justify-end")}>
                    {formatEconomyMetric(pt.previous)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </AppModalShell>
    </AppModalOverlay>
  );
}
