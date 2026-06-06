"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState, type MouseEvent } from "react";
import { AppModalOverlay } from "@/components/ui/app-modal-overlay";
import { AppModalCloseButton, AppModalShell } from "@/components/ui/app-modal-shell";

import { CHART_PLOT_DOTS_PATTERN_CLASS } from "@/components/chart/overview-bottom-axis";
import {
  computeFundamentalsChartTooltipPlacement,
  FUNDAMENTALS_CHART_AXIS_LABEL_ROTATE_DEG,
  FUNDAMENTALS_CHART_AXIS_ROW_PX,
  FUNDAMENTALS_CHART_HOVER_BAND_BG,
  FUNDAMENTALS_CHART_PLOT_INSET_BOTTOM_FRAC,
  FUNDAMENTALS_CHART_PLOT_INSET_TOP_FRAC,
  FUNDAMENTALS_CHART_TOOLTIP_CLASS,
  FUNDAMENTALS_CHART_Y_AXIS_LABEL_COUNT,
  FUNDAMENTALS_CHART_Y_AXIS_PADDING_CLASS,
  FUNDAMENTALS_CHART_Y_AXIS_W_PX,
  FUNDAMENTALS_CHART_ZERO_BASELINE_BORDER,
} from "@/lib/chart/fundamentals-chart-surface";
import { formatEconomyMetric } from "@/lib/market/economy-format-display";
import type { EconomyCalendarEvent } from "@/lib/market/economy-calendar-types";
import { cn } from "@/lib/utils";

type HistoryPoint = {
  date: string;
  period: string | null;
  actual: number | null;
  estimate: number | null;
  previous: number | null;
};

const POSITIVE_BAR_COLOR = "#2563EB";
const NEGATIVE_BAR_COLOR = "#DC2626";
const CHART_PLOT_HEIGHT_PX = 320;
const CHART_TOTAL_HEIGHT_PX = CHART_PLOT_HEIGHT_PX + FUNDAMENTALS_CHART_AXIS_ROW_PX;
const BAR_WIDTH_PX = 14;
const BAR_MAX_HEIGHT_FRAC = 0.88;

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

function formatYAxisValue(n: number): string {
  if (!Number.isFinite(n)) return "";
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (abs >= 10_000) return `${(n / 1_000).toFixed(1)}K`;
  if (abs >= 1_000) return new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(n);
  if (!Number.isInteger(n)) return `${n.toFixed(2)}%`;
  return String(n);
}

type EconomyChartScale = {
  maxPos: number;
  maxNeg: number;
};

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

function computeEconomyChartScale(values: number[]): EconomyChartScale {
  let maxPos = 0;
  let maxNeg = 0;
  for (const v of values) {
    if (v > 0) maxPos = Math.max(maxPos, v);
    if (v < 0) maxNeg = Math.max(maxNeg, -v);
  }
  return { maxPos: Math.max(maxPos, 1), maxNeg };
}

function buildEconomyYAxisTicks(maxPos: number, maxNeg: number): number[] {
  if (maxNeg <= 0) {
    const top = Math.max(maxPos, 1);
    const n = FUNDAMENTALS_CHART_Y_AXIS_LABEL_COUNT;
    return Array.from({ length: n }, (_, i) => (top * (n - 1 - i)) / (n - 1));
  }
  const span = maxPos + maxNeg;
  const n = FUNDAMENTALS_CHART_Y_AXIS_LABEL_COUNT;
  return Array.from({ length: n }, (_, i) => maxPos - (i / (n - 1)) * span);
}

function economyTickTopPercent(tick: number, scale: EconomyChartScale): number {
  const span = scale.maxPos + scale.maxNeg;
  if (span <= 0) return 100;
  return 100 - ((tick + scale.maxNeg) / span) * 100;
}

type TipState = {
  anchorX: number;
  y: number;
  side: "left" | "right";
  periodLabel: string;
  valueLine: string;
  dotColor: string;
};

function EconomyHistoryBar({
  value,
  scale,
  fill,
  direction,
}: {
  value: number;
  scale: EconomyChartScale;
  fill: string;
  direction: "up" | "down";
}) {
  const cap = BAR_MAX_HEIGHT_FRAC * 100;
  const hPct =
    direction === "up"
      ? (value / scale.maxPos) * cap
      : (-value / Math.max(scale.maxNeg, 1)) * cap;
  if (hPct <= 0) return <div style={{ width: BAR_WIDTH_PX }} aria-hidden />;
  const rounded = direction === "up" ? "rounded-t-[2px]" : "rounded-b-[2px]";
  return (
    <div
      className={cn("shrink-0", rounded)}
      style={{
        width: BAR_WIDTH_PX,
        maxWidth: "100%",
        height: `${hPct}%`,
        minHeight: 2,
        backgroundColor: fill,
      }}
    />
  );
}

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
  const scale = useMemo(() => computeEconomyChartScale(values), [values]);
  const yTicks = useMemo(
    () => buildEconomyYAxisTicks(scale.maxPos, scale.maxNeg),
    [scale.maxPos, scale.maxNeg],
  );

  const plotInsetTop = `${FUNDAMENTALS_CHART_PLOT_INSET_TOP_FRAC * 100}%`;
  const plotInsetBottom = `${FUNDAMENTALS_CHART_PLOT_INSET_BOTTOM_FRAC * 100}%`;
  const n = columns.length;

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
            </div>

            <div
              className="absolute inset-x-0 z-[1] flex min-h-0 w-full min-w-0 flex-col overflow-hidden"
              style={{ top: plotInsetTop, bottom: plotInsetBottom }}
            >
              <div
                className="pointer-events-none absolute inset-x-0 border-t"
                style={{
                  top: `${economyTickTopPercent(0, scale)}%`,
                  borderColor: FUNDAMENTALS_CHART_ZERO_BASELINE_BORDER,
                }}
                aria-hidden
              />
              {columns.map((col, i) => (
                <div
                  key={`${col.axisLabel}-${i}`}
                  className="absolute top-0 bottom-0 z-[2] flex -translate-x-1/2 flex-col"
                  style={{ left: `${col.leftPct}%`, width: BAR_WIDTH_PX + 12 }}
                  onMouseEnter={(e) => handleColumnHover(e, i, col)}
                  onMouseMove={(e) => handleColumnHover(e, i, col)}
                >
                  {hoveredIndex === i ? (
                    <div
                      className="pointer-events-none absolute inset-0 z-0"
                      style={{ backgroundColor: FUNDAMENTALS_CHART_HOVER_BAND_BG }}
                      aria-hidden
                    />
                  ) : null}
                  <div
                    className="relative z-10 flex min-h-0 w-full flex-1 items-end justify-center"
                    style={{ flex: scale.maxPos }}
                  >
                    {col.value >= 0 ? (
                      <EconomyHistoryBar
                        value={col.value}
                        scale={scale}
                        fill={POSITIVE_BAR_COLOR}
                        direction="up"
                      />
                    ) : null}
                  </div>
                  {scale.maxNeg > 0 ? (
                    <div
                      className="relative z-10 flex min-h-0 w-full items-start justify-center"
                      style={{ flex: scale.maxNeg }}
                    >
                      {col.value < 0 ? (
                        <EconomyHistoryBar
                          value={col.value}
                          scale={scale}
                          fill={NEGATIVE_BAR_COLOR}
                          direction="down"
                        />
                      ) : null}
                    </div>
                  ) : null}
                </div>
              ))}
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
              >
                <p className="text-[12px] font-semibold leading-4 text-[#09090B]">{tip.periodLabel}</p>
                <p className="mt-1.5 flex items-center gap-2 whitespace-nowrap text-[12px] font-normal leading-4 text-[#71717A]">
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
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
                  style={{ top: `${economyTickTopPercent(t, scale)}%` }}
                >
                  {formatYAxisValue(t)}
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
        maxWidthClass="w-full max-w-[min(960px,calc(100vw-2rem))]"
        maxHeightClass="max-h-[min(92vh,720px)]"
        bodyScroll={false}
        header={
          <div className="flex w-full items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <h2 id={titleId} className="truncate text-[18px] font-semibold leading-7 text-[#09090B]">
                {eventLabel}
              </h2>
              {latestActual && (
                <div className="mt-0.5 flex flex-wrap items-baseline gap-x-3 text-[13px] leading-5 text-[#71717A]">
                  {latestActual.actual != null && (
                    <span>
                      Actual: <span className="font-medium text-[#09090B]">{formatEconomyMetric(latestActual.actual)}</span>
                    </span>
                  )}
                  {latestActual.estimate != null && (
                    <span>
                      Forecast: <span className="font-medium text-[#09090B]">{formatEconomyMetric(latestActual.estimate)}</span>
                    </span>
                  )}
                  {latestActual.previous != null && (
                    <span>
                      Prior: <span className="font-medium text-[#09090B]">{formatEconomyMetric(latestActual.previous)}</span>
                    </span>
                  )}
                </div>
              )}
            </div>
            <AppModalCloseButton onClick={onClose} />
          </div>
        }
        headerClassName="border-b border-[#E4E4E7] px-5 py-4"
        bodyClassName="flex min-h-0 flex-1 flex-col overflow-hidden p-0"
        cardClassName="overflow-hidden"
      >
        <div className="min-h-0 flex-1 overflow-hidden px-5 py-4">
          {loading ? (
            <div
              className="flex items-center justify-center text-[14px] text-[#71717A]"
              style={{ height: CHART_TOTAL_HEIGHT_PX }}
            >
              Loading historical data…
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
            <EconomyHistoryBarChart points={points} eventLabel={eventLabel} />
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
