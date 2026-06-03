"use client";

import { memo, useMemo, useRef, useState, type MouseEvent } from "react";
import { format, parseISO } from "date-fns";

import { CHART_PLOT_DOTS_PATTERN_CLASS } from "@/components/chart/overview-bottom-axis";
import {
  buildFundamentalsYAxisTicks,
  computeFundamentalsChartTooltipPlacement,
  FUNDAMENTALS_CHART_HOVER_BAND_BG,
  FUNDAMENTALS_CHART_TOOLTIP_CLASS,
  formatFundamentalsAxisTickLabel,
} from "@/lib/chart/fundamentals-chart-surface";
import {
  fundamentalsBarColorAtIndex,
  fundamentalsBarSolidAtIndex,
} from "@/lib/colors/fundamentals-multi-bar-colors";
import { formatUsdCompact } from "@/lib/market/key-stats-basic-format";
import type { PortfolioDividendScheduleMonth } from "@/lib/portfolio/portfolio-dividends-schedule-types";
import { cn } from "@/lib/utils";

const DECLARED_BAR = fundamentalsBarSolidAtIndex(0);
const ESTIMATED_BAR = fundamentalsBarColorAtIndex(0, 0.42);

const PLOT_INSET_TOP_FRAC = 0.08;
const PLOT_INSET_BOTTOM_FRAC = 0.04;
const CHART_ZERO_BASELINE_BORDER = "rgba(228, 228, 231, 0.85)";
const AXIS_LABEL_ROTATE_DEG = -42;
const MULTICHART_AXIS_ROW_PX = 32;
const MULTICHART_AXIS_BOTTOM_PAD_PX = 10;
const Y_AXIS_W_PX = 50;
const CHART_HEIGHT_PX = 268;

const BAR_WIDTH_SINGLE_PX = 18;
const BAR_WIDTH_PAIR_PX = 12;
const BAR_GAP_PX = 4;
const BAR_HOVER_PAD_PX = 6;

const BAR_VALUE_LABEL_CLASS =
  "pointer-events-none absolute z-[15] max-w-[5.5rem] truncate text-center text-[11px] font-semibold leading-none tabular-nums text-[#09090B]";

const BAR_VALUE_LABEL_TEXT_SHADOW =
  "0 0 3px rgba(255,255,255,0.95), 0 1px 2px rgba(255,255,255,0.8)";

type MonthBar = {
  key: string;
  axisLabel: string;
  title: string;
  declaredUsd: number;
  estimatedUsd: number;
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

function barValueLabelTopStyle(hPct: number): string {
  const insetTop = PLOT_INSET_TOP_FRAC * 100;
  const insetBottom = PLOT_INSET_BOTTOM_FRAC * 100;
  const band = 100 - insetTop - insetBottom;
  const fromBottom = (hPct / 100) * band;
  return `${insetTop + band - fromBottom}%`;
}

function formatBarUsdLabel(n: number): string {
  if (n >= 1000) return formatUsdCompact(n);
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: n >= 100 ? 0 : 1, maximumFractionDigits: 1 })}`;
}

function buildMonthBars(months: PortfolioDividendScheduleMonth[]): MonthBar[] {
  return months.map((m) => {
    let declaredUsd = 0;
    let estimatedUsd = 0;
    for (const row of m.rows) {
      if (row.status === "declared") declaredUsd += row.totalUsd;
      else estimatedUsd += row.totalUsd;
    }
    const labelDate = parseISO(`${m.monthKey}-01`);
    return {
      key: m.monthKey,
      axisLabel: format(labelDate, "MMM"),
      title: m.label,
      declaredUsd,
      estimatedUsd,
    };
  });
}

type BarTooltipState = {
  anchorX: number;
  y: number;
  side: "left" | "right";
  periodLabel: string;
  declaredUsd: number;
  estimatedUsd: number;
};

function PortfolioDividendsChartInner({ months }: { months: PortfolioDividendScheduleMonth[] }) {
  const plotAreaRef = useRef<HTMLDivElement>(null);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [tip, setTip] = useState<BarTooltipState | null>(null);

  const periods = useMemo(() => buildMonthBars(months), [months]);
  const plotHeight = CHART_HEIGHT_PX - MULTICHART_AXIS_ROW_PX - MULTICHART_AXIS_BOTTOM_PAD_PX;

  const { maxV, yTicks } = useMemo(() => {
    let rawMax = 0;
    for (const p of periods) {
      rawMax = Math.max(rawMax, p.declaredUsd, p.estimatedUsd);
    }
    const tickValues = buildFundamentalsYAxisTicks(rawMax || 1, "usd");
    const top = tickValues[0] ?? 1;
    return { maxV: top, yTicks: tickValues };
  }, [periods]);

  const n = periods.length;
  const showChart = n > 0;

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
      declaredUsd: p.declaredUsd,
      estimatedUsd: p.estimatedUsd,
    });
  };

  if (!showChart) return null;

  return (
    <section className="mb-10 w-full min-w-0 max-w-full overflow-x-hidden">
      <div className="relative flex w-full min-w-0 flex-col overflow-visible" style={{ height: CHART_HEIGHT_PX }}>
        <div className="flex min-h-0 w-full min-w-0 flex-1" style={{ height: plotHeight }}>
          <div ref={plotAreaRef} className="relative min-h-0 min-w-0 flex-1" onPointerLeave={clearHover}>
            <div
              className="pointer-events-none absolute inset-x-0 top-[8%] bottom-[4%] z-0 bg-white"
              aria-hidden
            >
              <div className={CHART_PLOT_DOTS_PATTERN_CLASS} />
              <div
                className="absolute inset-x-0 bottom-0 border-t"
                style={{ borderColor: CHART_ZERO_BASELINE_BORDER }}
              />
            </div>

            <div
              className="absolute inset-x-0 top-[8%] bottom-[4%] min-h-0 w-full min-w-0"
              role="img"
              aria-label="Monthly dividend payouts declared and estimated"
            >
              {periods.map((p, i) => {
                const leftPct = periodCenterLeftPercent(i, n);
                const hasDeclared = p.declaredUsd > 0;
                const hasEstimated = p.estimatedUsd > 0;
                const pair = hasDeclared && hasEstimated;
                const barWidthPx = pair ? BAR_WIDTH_PAIR_PX : BAR_WIDTH_SINGLE_PX;
                const groupWidthPx = pair ? BAR_WIDTH_PAIR_PX * 2 + BAR_GAP_PX : BAR_WIDTH_SINGLE_PX;
                const hitWidthPx = groupWidthPx + BAR_HOVER_PAD_PX * 2;
                const groupTopUsd = Math.max(p.declaredUsd, p.estimatedUsd);

                return (
                  <div
                    key={p.key}
                    className="absolute bottom-0 z-0 flex h-full min-h-0 -translate-x-1/2 flex-col items-center justify-end"
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

                    <div
                      className="relative z-10 flex h-full min-h-0 items-end justify-center gap-1"
                      style={{ width: groupWidthPx }}
                    >
                      {hasDeclared ? (
                        <div className="relative flex h-full min-h-0 flex-col items-center justify-end">
                          <div
                            className="mt-auto shrink-0 rounded-t-[2px] rounded-b-none"
                            style={{
                              width: barWidthPx,
                              height: `${valueHeightPct(p.declaredUsd, maxV)}%`,
                              minHeight: p.declaredUsd > 0 ? 2 : 0,
                              backgroundColor: DECLARED_BAR,
                            }}
                          />
                        </div>
                      ) : null}
                      {hasEstimated ? (
                        <div className="relative flex h-full min-h-0 flex-col items-center justify-end">
                          <div
                            className="mt-auto shrink-0 rounded-t-[2px] rounded-b-none"
                            style={{
                              width: barWidthPx,
                              height: `${valueHeightPct(p.estimatedUsd, maxV)}%`,
                              minHeight: p.estimatedUsd > 0 ? 2 : 0,
                              backgroundColor: ESTIMATED_BAR,
                            }}
                          />
                        </div>
                      ) : null}
                    </div>

                    {groupTopUsd > 0 ? (
                      <div
                        className={cn(BAR_VALUE_LABEL_CLASS, "absolute left-1/2")}
                        style={{
                          left: "50%",
                          top: barValueLabelTopStyle(valueHeightPct(groupTopUsd, maxV)),
                          transform: "translate(-50%, -100%)",
                          textShadow: BAR_VALUE_LABEL_TEXT_SHADOW,
                        }}
                      >
                        {formatBarUsdLabel(groupTopUsd)}
                      </div>
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
                {tip.declaredUsd > 0 ? (
                  <p className="mt-1 text-[12px] leading-4 text-[#09090B]">
                    <span className="inline-block h-2 w-2 rounded-sm align-middle" style={{ background: DECLARED_BAR }} />{" "}
                    Declared: {formatUsdCompact(tip.declaredUsd)}
                  </p>
                ) : null}
                {tip.estimatedUsd > 0 ? (
                  <p className="mt-0.5 text-[12px] leading-4 text-[#09090B]">
                    <span className="inline-block h-2 w-2 rounded-sm align-middle" style={{ background: ESTIMATED_BAR }} />{" "}
                    Estimated: {formatUsdCompact(tip.estimatedUsd)}
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>

          <div
            className="relative h-full shrink-0 pl-1.5 text-left font-['Inter'] text-[12px] tabular-nums leading-none text-[#71717A]"
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
                    className="absolute left-0 z-[1] block -translate-y-1/2 rounded-sm bg-white px-0.5 py-px"
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
                  className="inline-block whitespace-nowrap font-['Inter'] text-[11px] font-normal tabular-nums leading-none text-[#71717A] sm:text-[12px]"
                  style={{
                    transform: `rotate(${AXIS_LABEL_ROTATE_DEG}deg)`,
                    transformOrigin: "center bottom",
                  }}
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

      <div className="mt-3 flex flex-wrap items-center justify-center gap-6 text-[12px] font-medium leading-4 text-[#71717A]">
        <span className="inline-flex items-center gap-2">
          <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: DECLARED_BAR }} aria-hidden />
          Declared
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: ESTIMATED_BAR }} aria-hidden />
          Estimated
        </span>
      </div>
    </section>
  );
}

export const PortfolioDividendsChart = memo(PortfolioDividendsChartInner);
