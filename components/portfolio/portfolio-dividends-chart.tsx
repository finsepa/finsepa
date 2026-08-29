"use client";

import { memo, useMemo, useRef, useState, type MouseEvent } from "react";
import { format, parseISO } from "date-fns";

import { CHART_PLOT_DOTS_PATTERN_CLASS } from "@/components/chart/overview-bottom-axis";
import {
  buildFundamentalsYAxisTicks,
  computeFundamentalsChartTooltipPlacement,
  FUNDAMENTALS_CHART_BAR_VALUE_LABEL_HEIGHT_PX,
  FUNDAMENTALS_CHART_HOVER_BAND_BG,
  FUNDAMENTALS_CHART_TOOLTIP_CLASS,
  FUNDAMENTALS_CHART_ZERO_BASELINE_BORDER,
  formatFundamentalsAxisTickLabel,
} from "@/lib/chart/fundamentals-chart-surface";
import { fundamentalsBarSolidAtIndex } from "@/lib/colors/fundamentals-multi-bar-colors";
import { formatUsdCompact } from "@/lib/market/key-stats-basic-format";
import type { PortfolioDividendScheduleMonth } from "@/lib/portfolio/portfolio-dividends-schedule-types";
import { cn } from "@/lib/utils";

const BAR_COLOR = fundamentalsBarSolidAtIndex(0);
/** Current calendar month — same red as axis label (`text-down`). */
const CURRENT_BAR_COLOR = "var(--fs-down)";
/** Future months — muted grey (theme token). */
const FUTURE_BAR_COLOR = "var(--fs-fg-subtle)";

const PLOT_INSET_TOP_FRAC = 0.08;
const PLOT_INSET_BOTTOM_FRAC = 0.04;
const MULTICHART_AXIS_ROW_PX = 28;
const MULTICHART_AXIS_BOTTOM_PAD_PX = 8;
const Y_AXIS_W_PX = 50;
const CHART_HEIGHT_PX = 268;

/** Match fundamentals / charting single-metric bar width. */
const BAR_WIDTH_PX = 18;
const BAR_HOVER_PAD_PX = 6;

/** Matches Charting workspace + multichart fundamentals bar value labels. */
const BAR_VALUE_LABEL_ANCHOR_CLASS =
  "pointer-events-none absolute z-[15] max-w-[5.5rem] -translate-x-1/2 -translate-y-full text-center";

const BAR_VALUE_LABEL_TEXT_CLASS =
  "block truncate text-[11px] font-semibold leading-none tabular-nums text-fg";

const BAR_VALUE_LABEL_TEXT_SHADOW = "var(--fs-chart-value-label-shadow)";

type MonthBar = {
  key: string;
  axisLabel: string;
  title: string;
  totalUsd: number;
  isFuture: boolean;
  isCurrent: boolean;
};

function periodCenterLeftPercent(i: number, n: number): number {
  if (n <= 0) return 50;
  if (n === 1) return 50;
  return ((i + 0.5) / n) * 100;
}

function valueHeightPct(v: number, maxV: number): number {
  if (!Number.isFinite(v) || v <= 0 || !Number.isFinite(maxV) || maxV <= 0) return 0;
  return (v / maxV) * 100;
}

/**
 * Label sits 4px above the bar top (same as charting / multichart fundamentals).
 * `hPct` is bar height from the bottom of the plot band (0–100).
 */
function barValueLabelTopStyle(hPctFromBottom: number): string {
  const barTopFromTopPct = 100 - Math.min(100, Math.max(0, hPctFromBottom));
  const minTopPx = FUNDAMENTALS_CHART_BAR_VALUE_LABEL_HEIGHT_PX + 4;
  return `max(${minTopPx}px, calc(${barTopFromTopPct}% - 4px))`;
}

function formatBarUsdLabel(n: number): string {
  if (n >= 1000) return formatUsdCompact(n);
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: n >= 100 ? 0 : 1, maximumFractionDigits: 1 })}`;
}

/** Always 12 months for the selected calendar year (zeros pad empty months). */
function buildMonthBars(
  months: PortfolioDividendScheduleMonth[],
  year: number,
  today = new Date(),
): MonthBar[] {
  const nowYear = today.getFullYear();
  const nowMonth = today.getMonth() + 1;
  const byKey = new Map(months.map((m) => [m.monthKey, m]));
  const out: MonthBar[] = [];
  for (let month = 1; month <= 12; month++) {
    const monthKey = `${year}-${String(month).padStart(2, "0")}`;
    const m = byKey.get(monthKey);
    const labelDate = parseISO(`${monthKey}-01`);
    const isFuture = year > nowYear || (year === nowYear && month > nowMonth);
    const isCurrent = year === nowYear && month === nowMonth;
    out.push({
      key: monthKey,
      axisLabel: format(labelDate, "MMM"),
      title: format(labelDate, "MMMM yyyy"),
      totalUsd: m?.totalUsd ?? 0,
      isFuture,
      isCurrent,
    });
  }
  return out;
}

type BarTooltipState = {
  anchorX: number;
  y: number;
  side: "left" | "right";
  periodLabel: string;
  totalUsd: number;
  barColor: string;
};

function PortfolioDividendsChartInner({
  months,
  year,
}: {
  months: PortfolioDividendScheduleMonth[];
  year: number;
}) {
  const plotAreaRef = useRef<HTMLDivElement>(null);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [tip, setTip] = useState<BarTooltipState | null>(null);

  const periods = useMemo(() => buildMonthBars(months, year), [months, year]);
  const plotHeight = CHART_HEIGHT_PX - MULTICHART_AXIS_ROW_PX - MULTICHART_AXIS_BOTTOM_PAD_PX;

  const { maxV, yTicks } = useMemo(() => {
    let rawMax = 0;
    for (const p of periods) {
      rawMax = Math.max(rawMax, p.totalUsd);
    }
    const tickValues = buildFundamentalsYAxisTicks(rawMax || 1, "usd");
    const top = tickValues[0] ?? 1;
    return { maxV: top, yTicks: tickValues };
  }, [periods]);

  const n = periods.length;

  const clearHover = () => {
    setHoveredIndex(null);
    setTip(null);
  };

  const updateTip = (e: MouseEvent<HTMLElement>, i: number) => {
    const plot = plotAreaRef.current;
    if (!plot) return;
    const p = periods[i]!;
    const col = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const plotRect = plot.getBoundingClientRect();
    const focusX = col.left + col.width / 2 - plotRect.left;
    const { anchorX, side } = computeFundamentalsChartTooltipPlacement(
      focusX,
      Math.max(1, Math.floor(plotRect.width)),
    );
    setHoveredIndex(i);
    setTip({
      anchorX,
      y: e.clientY - plotRect.top,
      side,
      periodLabel: p.title,
      totalUsd: p.totalUsd,
      barColor: p.isCurrent
        ? CURRENT_BAR_COLOR
        : p.isFuture
          ? FUTURE_BAR_COLOR
          : BAR_COLOR,
    });
  };

  return (
    <section className="mb-5 w-full min-w-0 max-w-full overflow-x-hidden">
      <div className="relative flex w-full min-w-0 flex-col overflow-visible" style={{ height: CHART_HEIGHT_PX }}>
        <div className="flex min-h-0 w-full min-w-0 flex-1" style={{ height: plotHeight }}>
          <div
            ref={plotAreaRef}
            className="relative min-h-0 min-w-0 flex-1 overflow-visible"
            onPointerLeave={clearHover}
          >
            <div
              className="pointer-events-none absolute inset-x-0 top-[8%] bottom-[4%] z-0 bg-panel"
              aria-hidden
            >
              <div className={CHART_PLOT_DOTS_PATTERN_CLASS} />
              <div
                className="absolute inset-x-0 bottom-0 border-t"
                style={{ borderColor: FUNDAMENTALS_CHART_ZERO_BASELINE_BORDER }}
              />
            </div>

            <div
              className="absolute inset-x-0 top-[8%] bottom-[4%] z-[1] min-h-0 w-full min-w-0 overflow-visible"
              role="img"
              aria-label={`Monthly dividend payouts for ${year}`}
            >
              {periods.map((p, i) => {
                const leftPct = periodCenterLeftPercent(i, n);
                const hitWidthPx = BAR_WIDTH_PX + BAR_HOVER_PAD_PX * 2;
                const hPct = valueHeightPct(p.totalUsd, maxV);
                const barColor = p.isCurrent
                  ? CURRENT_BAR_COLOR
                  : p.isFuture
                    ? FUTURE_BAR_COLOR
                    : BAR_COLOR;

                return (
                  <div
                    key={p.key}
                    className="absolute bottom-0 z-0 h-full min-h-0 -translate-x-1/2"
                    style={{ left: `${leftPct}%`, width: hitWidthPx }}
                    onPointerEnter={(e) => updateTip(e, i)}
                    onPointerMove={(e) => updateTip(e, i)}
                  >
                    {hoveredIndex === i ? (
                      <div
                        className="pointer-events-none absolute bottom-0 left-1/2 z-0 h-full -translate-x-1/2"
                        style={{
                          width: Math.max(hitWidthPx, 28),
                          backgroundColor: FUNDAMENTALS_CHART_HOVER_BAND_BG,
                        }}
                        aria-hidden
                      />
                    ) : null}

                    {p.totalUsd > 0 ? (
                      <div
                        className="absolute bottom-0 left-1/2 z-10 -translate-x-1/2 rounded-t-[2px] rounded-b-none"
                        style={{
                          width: BAR_WIDTH_PX,
                          height: `${hPct}%`,
                          minHeight: 2,
                          backgroundColor: barColor,
                        }}
                      />
                    ) : null}

                    {p.totalUsd > 0 ? (
                      <div
                        className={BAR_VALUE_LABEL_ANCHOR_CLASS}
                        style={{
                          left: "50%",
                          top: barValueLabelTopStyle(hPct),
                        }}
                        title={formatBarUsdLabel(p.totalUsd)}
                      >
                        <span
                          className={BAR_VALUE_LABEL_TEXT_CLASS}
                          style={{ textShadow: BAR_VALUE_LABEL_TEXT_SHADOW }}
                        >
                          {formatBarUsdLabel(p.totalUsd)}
                        </span>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>

            {tip && tip.totalUsd > 0 ? (
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
                <p className="text-[12px] font-semibold leading-4 text-fg">{tip.periodLabel}</p>
                <p className="mt-1 text-[12px] leading-4 text-fg">
                  <span
                    className="inline-block h-2 w-2 rounded-sm align-middle"
                    style={{ background: tip.barColor }}
                  />{" "}
                  {formatUsdCompact(tip.totalUsd)}
                </p>
              </div>
            ) : null}
          </div>

          <div
            className="relative h-full shrink-0 pl-1.5 text-left font-['Inter'] text-[12px] tabular-nums leading-none text-fg-muted"
            style={{ width: Y_AXIS_W_PX }}
            aria-hidden
          >
            <div className="pointer-events-none absolute inset-0">
              {yTicks.map((t, i) => {
                const nt = yTicks.length;
                const pct = nt <= 1 ? 0 : i / (nt - 1);
                const insetSpan = 0.92;
                return (
                  <span
                    key={i}
                    className="absolute left-0 z-[1] block -translate-y-1/2 rounded-sm bg-panel px-0.5 py-px"
                    style={{ top: `${(PLOT_INSET_TOP_FRAC + pct * insetSpan) * 100}%` }}
                  >
                    {formatFundamentalsAxisTickLabel("usd", t)}
                  </span>
                );
              })}
            </div>
          </div>
        </div>

        <div className="flex w-full min-w-0 overflow-visible" style={{ height: MULTICHART_AXIS_ROW_PX }}>
          <div className="relative mb-1 min-w-0 flex-1 px-0" style={{ height: MULTICHART_AXIS_ROW_PX }}>
            {periods.map((p, i) => (
              <div
                key={`axis-${p.key}`}
                className="absolute bottom-0.5 flex max-w-[min(100%,4.5rem)] -translate-x-1/2 justify-center overflow-visible"
                style={{ left: `${periodCenterLeftPercent(i, n)}%` }}
                title={p.title}
              >
                <span
                  className={cn(
                    "inline-block whitespace-nowrap font-['Inter'] text-[11px] font-normal tabular-nums leading-none sm:text-[12px]",
                    p.isCurrent ? "font-semibold text-down" : "text-fg-muted",
                  )}
                >
                  {p.axisLabel}
                </span>
              </div>
            ))}
          </div>
          <div className="shrink-0 pl-1.5" style={{ width: Y_AXIS_W_PX }} aria-hidden />
        </div>
        <div className="shrink-0" style={{ height: MULTICHART_AXIS_BOTTOM_PAD_PX }} aria-hidden />
      </div>
    </section>
  );
}

export const PortfolioDividendsChart = memo(PortfolioDividendsChartInner);
