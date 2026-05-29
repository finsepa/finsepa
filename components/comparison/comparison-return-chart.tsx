"use client";

import { useMemo, useRef, useState, type MouseEvent } from "react";

import { CHART_PLOT_DOTS_PATTERN_CLASS } from "@/components/chart/overview-bottom-axis";
import { ComparisonReturnChartSkeleton } from "@/components/comparison/comparison-skeletons";
import {
  annualReturnPctForYear,
  comparisonAnnualReturnYears,
} from "@/lib/market/stock-annual-returns";
import {
  computeFundamentalsChartTooltipPlacement,
  FUNDAMENTALS_CHART_HOVER_BAND_BG,
  FUNDAMENTALS_CHART_PLOT_INSET_BOTTOM_FRAC,
  FUNDAMENTALS_CHART_PLOT_INSET_TOP_FRAC,
  FUNDAMENTALS_CHART_TOOLTIP_CLASS,
  FUNDAMENTALS_CHART_ZERO_BASELINE_BORDER,
  FUNDAMENTALS_CHART_Y_AXIS_LABEL_COUNT,
} from "@/lib/chart/fundamentals-chart-surface";
import type { StockPerformance } from "@/lib/market/stock-performance-types";

const RETURN_CHART_PLOT_HEIGHT_PX = 288;
const RETURN_CHART_AXIS_ROW_PX = 32;
const RETURN_CHART_TOTAL_HEIGHT_PX = RETURN_CHART_PLOT_HEIGHT_PX + RETURN_CHART_AXIS_ROW_PX;
const RETURN_CHART_Y_AXIS_W_PX = 56;

const BAR_WIDTH_PX = 22;
const BAR_GAP_PX = 4;
const BAR_HIT_PAD_PX = 10;
/** Cap bar height inside each zone so columns stay inside the plot band. */
const RETURN_BAR_MAX_HEIGHT_FRAC = 0.88;

type ReturnChartScale = {
  maxPos: number;
  maxNeg: number;
};

type SeriesBar = {
  ticker: string;
  value: number;
  color: string;
};

type YearColumn = {
  year: number;
  leftPct: number;
  bars: SeriesBar[];
};

type TooltipState = {
  anchorX: number;
  y: number;
  side: "left" | "right";
  periodLabel: string;
  lines: { ticker: string; text: string; color: string }[];
};

function periodCenterLeftPercent(i: number, n: number): number {
  if (n <= 0) return 50;
  if (n === 1) return 50;
  return ((i + 0.5) / n) * 100;
}

function formatReturnPct(v: number): string {
  if (!Number.isFinite(v)) return "—";
  const sign = v > 0 ? "+" : v < 0 ? "−" : "";
  return `${sign}${Math.abs(v).toFixed(2)}%`;
}

function formatReturnAxisTick(v: number): string {
  if (!Number.isFinite(v)) return "";
  const sign = v < 0 ? "−" : "";
  return `${sign}${Math.abs(v).toFixed(2)}%`;
}

function yearColumnHitWidthPx(barCount: number): number {
  const n = Math.max(1, barCount);
  return n * BAR_WIDTH_PX + (n - 1) * BAR_GAP_PX + BAR_HIT_PAD_PX * 2;
}

function computeReturnChartScale(columns: YearColumn[]): ReturnChartScale {
  let maxPos = 0;
  let maxNeg = 0;
  for (const col of columns) {
    for (const b of col.bars) {
      if (b.value > 0) maxPos = Math.max(maxPos, b.value);
      if (b.value < 0) maxNeg = Math.max(maxNeg, -b.value);
    }
  }
  return { maxPos: Math.max(maxPos, 1), maxNeg };
}

function buildReturnChartYAxisTicks(maxPos: number, maxNeg: number): number[] {
  if (maxNeg <= 0) {
    const top = Math.max(maxPos, 1);
    const n = FUNDAMENTALS_CHART_Y_AXIS_LABEL_COUNT;
    return Array.from({ length: n }, (_, i) => (top * (n - 1 - i)) / (n - 1));
  }
  const span = maxPos + maxNeg;
  const n = FUNDAMENTALS_CHART_Y_AXIS_LABEL_COUNT;
  return Array.from({ length: n }, (_, i) => maxPos - (i / (n - 1)) * span);
}

/** Map tick value to % from top of the plot band (0 = top, 100 = bottom). */
function returnTickTopPercent(tick: number, scale: ReturnChartScale): number {
  const span = scale.maxPos + scale.maxNeg;
  if (span <= 0) return 100;
  return 100 - ((tick + scale.maxNeg) / span) * 100;
}

function tooltipFromEvent(
  e: MouseEvent,
  plot: HTMLElement,
  year: number,
  lines: TooltipState["lines"],
): TooltipState {
  const plotR = plot.getBoundingClientRect();
  const { anchorX, side } = computeFundamentalsChartTooltipPlacement(
    e.clientX - plotR.left,
    Math.max(1, Math.floor(plotR.width)),
  );
  return {
    anchorX,
    y: e.clientY - plotR.top,
    side,
    periodLabel: String(year),
    lines,
  };
}

function ComparisonReturnBar({
  value,
  scale,
  fill,
  direction,
}: {
  value: number;
  scale: ReturnChartScale;
  fill: string;
  direction: "up" | "down";
}) {
  const cap = RETURN_BAR_MAX_HEIGHT_FRAC * 100;
  const hPct =
    direction === "up"
      ? (value / scale.maxPos) * cap
      : (-value / Math.max(scale.maxNeg, 1)) * cap;
  if (hPct <= 0) return <div style={{ width: BAR_WIDTH_PX }} aria-hidden />;
  const rounded = direction === "up" ? "rounded-t-[2px]" : "rounded-b-[2px]";
  return (
    <div
      className={`w-full ${rounded}`}
      style={{ height: `${hPct}%`, minHeight: 2, backgroundColor: fill }}
    />
  );
}

export function ComparisonReturnChart({
  tickers,
  performances,
  colors,
  loading = false,
}: {
  tickers: string[];
  performances: Record<string, StockPerformance | null | undefined>;
  colors: readonly string[];
  loading?: boolean;
}) {
  const plotAreaRef = useRef<HTMLDivElement>(null);
  const [hoveredYear, setHoveredYear] = useState<number | null>(null);
  const [tip, setTip] = useState<TooltipState | null>(null);

  const chartYears = useMemo(() => {
    for (const t of tickers) {
      const rows = performances[t]?.annualReturns;
      if (rows?.length) return rows.map((r) => r.year);
    }
    return comparisonAnnualReturnYears();
  }, [tickers, performances]);

  const yearColumns = useMemo((): YearColumn[] => {
    const nYears = chartYears.length;
    return chartYears.map((year, yearIndex) => {
      const bars: SeriesBar[] = [];
      tickers.forEach((sym, j) => {
        const v = annualReturnPctForYear(performances[sym], year);
        if (v == null) return;
        bars.push({
          ticker: sym,
          value: v,
          color: colors[j] ?? "#2563EB",
        });
      });
      return {
        year,
        leftPct: periodCenterLeftPercent(yearIndex, nYears),
        bars,
      };
    });
  }, [chartYears, tickers, performances, colors]);

  const scale = useMemo(() => computeReturnChartScale(yearColumns), [yearColumns]);

  const yTicks = useMemo(
    () => buildReturnChartYAxisTicks(scale.maxPos, scale.maxNeg),
    [scale.maxPos, scale.maxNeg],
  );

  const hasAnyBar = yearColumns.some((c) => c.bars.length > 0);

  const ariaSummary = useMemo(() => {
    const parts: string[] = [];
    for (const t of tickers) {
      const bits = chartYears
        .map((year) => {
          const v = annualReturnPctForYear(performances[t], year);
          return `${year} ${v != null ? formatReturnPct(v) : "—"}`;
        })
        .join(", ");
      parts.push(`${t}: ${bits}`);
    }
    return parts.join(" · ");
  }, [tickers, performances, chartYears]);

  const clearHover = () => {
    setHoveredYear(null);
    setTip(null);
  };

  if (loading) {
    return <ComparisonReturnChartSkeleton />;
  }

  return (
    <section className="w-full min-w-0 max-w-full overflow-hidden bg-white">
      <h3 className="mb-4 text-[18px] font-semibold leading-7 tracking-tight text-[#09090B]">Return</h3>

      <div>
        {tickers.length === 0 ? (
          <div
            className="flex items-center justify-center text-[14px] text-[#71717A]"
            style={{ height: RETURN_CHART_TOTAL_HEIGHT_PX }}
          >
            Add companies to compare returns.
          </div>
        ) : hasAnyBar ? (
          <div
            className="relative w-full min-w-0 max-w-full overflow-x-hidden"
            style={{ height: RETURN_CHART_TOTAL_HEIGHT_PX }}
            role="img"
            aria-label={`Return chart for ${tickers.join(", ")}`}
            title={ariaSummary}
          >
            <div
              className="box-border flex w-full min-w-0 max-w-full flex-col overflow-hidden px-2 sm:px-3"
              style={{ height: RETURN_CHART_TOTAL_HEIGHT_PX }}
            >
              <div
                className="flex min-h-0 w-full min-w-0 overflow-hidden"
                style={{ height: RETURN_CHART_PLOT_HEIGHT_PX }}
              >
                <div
                  ref={plotAreaRef}
                  className="relative min-h-0 min-w-0 flex-1 overflow-hidden"
                  onPointerLeave={clearHover}
                >
                  <div
                    className="pointer-events-none absolute inset-x-0 top-[8%] bottom-[4%] z-0 bg-white"
                    aria-hidden
                  >
                    <div className={CHART_PLOT_DOTS_PATTERN_CLASS} />
                  </div>

                  <div className="absolute inset-x-0 top-[8%] bottom-[4%] z-[1] flex min-h-0 w-full min-w-0 flex-col overflow-hidden">
                    <div
                      className="pointer-events-none absolute inset-x-0 border-t"
                      style={{
                        top: `${returnTickTopPercent(0, scale)}%`,
                        borderColor: FUNDAMENTALS_CHART_ZERO_BASELINE_BORDER,
                      }}
                      aria-hidden
                    />
                    {yearColumns.map((col) => {
                      if (!col.bars.length) return null;
                      const hitW = yearColumnHitWidthPx(col.bars.length);
                      const lines = col.bars.map((b) => ({
                        ticker: b.ticker,
                        text: formatReturnPct(b.value),
                        color: b.color,
                      }));
                      const posBars = col.bars.filter((b) => b.value >= 0);
                      const negBars = col.bars.filter((b) => b.value < 0);
                      return (
                        <div
                          key={col.year}
                          className="absolute top-0 bottom-0 z-[2] flex -translate-x-1/2 flex-col"
                          style={{ left: `${col.leftPct}%`, width: hitW }}
                          onMouseEnter={(e) => {
                            const plot = plotAreaRef.current;
                            if (!plot) return;
                            setHoveredYear(col.year);
                            setTip(tooltipFromEvent(e, plot, col.year, lines));
                          }}
                          onMouseMove={(e) => {
                            const plot = plotAreaRef.current;
                            if (!plot) return;
                            setHoveredYear(col.year);
                            setTip(tooltipFromEvent(e, plot, col.year, lines));
                          }}
                        >
                          {hoveredYear === col.year ? (
                            <div
                              className="pointer-events-none absolute inset-0 z-0"
                              style={{ backgroundColor: FUNDAMENTALS_CHART_HOVER_BAND_BG }}
                              aria-hidden
                            />
                          ) : null}
                          <div
                            className="relative z-10 flex min-h-0 w-full flex-1 items-end justify-center gap-1"
                            style={{ flex: scale.maxPos }}
                          >
                            {posBars.map((b) => (
                              <ComparisonReturnBar
                                key={`${col.year}-${b.ticker}-up`}
                                value={b.value}
                                scale={scale}
                                fill={b.color}
                                direction="up"
                              />
                            ))}
                          </div>
                          {scale.maxNeg > 0 ? (
                            <div
                              className="relative z-10 flex min-h-0 w-full items-start justify-center gap-1"
                              style={{ flex: scale.maxNeg }}
                            >
                              {negBars.map((b) => (
                                <ComparisonReturnBar
                                  key={`${col.year}-${b.ticker}-down`}
                                  value={b.value}
                                  scale={scale}
                                  fill={b.color}
                                  direction="down"
                                />
                              ))}
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>

                  {tip ? (
                    <div
                      className={`${FUNDAMENTALS_CHART_TOOLTIP_CLASS} pointer-events-none absolute z-30`}
                      style={{
                        left: `clamp(8px, ${tip.anchorX}px, calc(100% - 8px))`,
                        top: tip.y,
                        transform:
                          tip.side === "left"
                            ? "translate(calc(-100% - 10px), -50%)"
                            : "translate(10px, -50%)",
                      }}
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
                      <div className="mt-1.5 space-y-0.5">
                        {tip.lines.map((line) => (
                          <p
                            key={line.ticker}
                            className="flex items-center gap-2 whitespace-nowrap text-[12px] font-normal leading-4 text-[#09090B]"
                          >
                            <span
                              className="h-2 w-2 shrink-0 rounded-full"
                              style={{ backgroundColor: line.color }}
                            />
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
                  className="relative h-full shrink-0 pl-1.5 text-left font-['Inter'] text-[12px] tabular-nums leading-none text-[#71717A]"
                  style={{ width: RETURN_CHART_Y_AXIS_W_PX }}
                  aria-hidden
                >
                  <div className="pointer-events-none absolute inset-x-0 top-[8%] bottom-[4%]">
                    {yTicks.map((t, i) => (
                      <span
                        key={i}
                        className="absolute left-0 z-[1] block -translate-y-1/2 rounded-sm bg-white px-0.5 py-px"
                        style={{ top: `${returnTickTopPercent(t, scale)}%` }}
                      >
                        {formatReturnAxisTick(t)}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div
                className="flex w-full shrink-0 pt-1.5"
                style={{ height: RETURN_CHART_AXIS_ROW_PX }}
              >
                <div
                  className="grid min-w-0 flex-1"
                  style={{
                    gridTemplateColumns: `repeat(${chartYears.length}, minmax(0, 1fr))`,
                  }}
                >
                  {chartYears.map((year) => (
                    <div key={year} className="min-w-0 px-0.5 text-center">
                      <span className="text-balance font-['Inter'] text-[11px] font-normal leading-snug text-[#71717A] sm:text-[12px]">
                        {year}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="shrink-0" style={{ width: RETURN_CHART_Y_AXIS_W_PX }} aria-hidden />
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
