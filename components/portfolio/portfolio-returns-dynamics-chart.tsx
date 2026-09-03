"use client";

import { resolveFsColor } from "@/lib/theme/resolve-fs-color";
import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { LineChart } from "@/lib/icons";

import { TabSwitcher, type TabSwitcherOption } from "@/components/design-system";
import { STOCK_OVERVIEW_SECTION_HEADING_CLASS } from "@/components/design-system/card-surface-styles";
import { SecondaryTabs, type SecondaryTabItem } from "@/components/ui/secondary-tabs";
import { PortfolioUpDownLegendSwatch } from "@/components/chart/portfolio-up-down-legend-swatch";
import { CHART_PLOT_DOTS_PATTERN_CLASS } from "@/components/chart/overview-bottom-axis";
import {
  FUNDAMENTALS_CHART_AXIS_LABEL_ROTATE_DEG,
  FUNDAMENTALS_CHART_AXIS_ROW_PX,
  FUNDAMENTALS_CHART_HOVER_BAND_BG,
  FUNDAMENTALS_CHART_PLOT_INSET_BOTTOM_FRAC,
  FUNDAMENTALS_CHART_PLOT_INSET_TOP_FRAC,
  FUNDAMENTALS_CHART_TOOLTIP_CLASS,
  FUNDAMENTALS_CHART_Y_AXIS_PADDING_CLASS,
  FUNDAMENTALS_CHART_Y_AXIS_W_PX,
  FUNDAMENTALS_CHART_ZERO_BASELINE_BORDER,
} from "@/lib/chart/fundamentals-chart-surface";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import type { PortfolioTransaction } from "@/components/portfolio/portfolio-types";
import type {
  PeriodReturnGranularity,
  PortfolioPeriodReturnBar,
} from "@/lib/portfolio/portfolio-period-returns-types";
import {
  latestPeriodReturnYear,
  periodReturnBarLabelForYear,
  portfolioPeriodReturnYears,
} from "@/lib/portfolio/portfolio-period-returns-years";
import { cn } from "@/lib/utils";

const BENCHMARK_SPY_BAR = "#EA580C";
const BENCHMARK_NASDAQ_BAR = "#9333EA";
/** Light: soft rose wash. Dark: `--fs-down-soft` (#49080e). */
const NEGATIVE_ZONE_CLASS = "bg-[rgba(254,242,242,0.92)] dark:bg-down-soft";
const NEGATIVE_ZONE_FILL_CLASS = "fill-[rgba(254,242,242,0.92)] dark:fill-down-soft";

/** Total chart height — plot band plus slanted period labels (matches Charting). */
const CHART_TOTAL_HEIGHT_PX = 320;
const CHART_PLOT_HEIGHT_PX = CHART_TOTAL_HEIGHT_PX - FUNDAMENTALS_CHART_AXIS_ROW_PX;
const CHART_PLOT_BACKDROP_INSET_CLASS = "top-[8%] bottom-[4%]";
/** Always six labeled ticks on the Y axis (five equal steps). */
const Y_AXIS_TICK_COUNT = 6;
const Y_AXIS_STEP_COUNT = Y_AXIS_TICK_COUNT - 1;

const GRANULARITY_OPTIONS: TabSwitcherOption<PeriodReturnGranularity>[] = [
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "annually", label: "Annually" },
];

const BENCHMARK_SPY_LABEL = "S&P 500";
const BENCHMARK_NASDAQ_LABEL = "Nasdaq";

function portfolioReturnBarColor(pct: number): string {
  return pct >= 0 ? resolveFsColor("--fs-up") : resolveFsColor("--fs-down");
}

function formatPctAxis(n: number): string {
  const rounded =
    Math.abs(n - Math.round(n)) < 1e-6 ? Math.round(n) : Math.round(n * 10) / 10;
  const intLike = Math.abs(rounded - Math.round(rounded)) < 1e-6;
  return (
    new Intl.NumberFormat("en-US", {
      maximumFractionDigits: intLike ? 0 : 1,
      signDisplay: "exceptZero",
    }).format(rounded) + "%"
  );
}

function niceStep(rough: number): number {
  if (!Number.isFinite(rough) || rough <= 0) return 5;
  const exp = Math.floor(Math.log10(rough));
  const f = rough / 10 ** exp;
  const nf = f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10;
  return nf * 10 ** exp;
}

function formatTooltipPct(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return (
    new Intl.NumberFormat("en-US", {
      maximumFractionDigits: 2,
      minimumFractionDigits: 0,
      signDisplay: "exceptZero",
    }).format(n) + "%"
  );
}

function niceYRange(
  values: number[],
): { yMin: number; yMax: number; ticks: number[] } {
  const G = Y_AXIS_STEP_COUNT;

  let lo = 0;
  let hi = 0;
  let any = false;
  for (const v of values) {
    if (!Number.isFinite(v)) continue;
    any = true;
    lo = Math.min(lo, v);
    hi = Math.max(hi, v);
  }

  if (!any) {
    const yMin = -10;
    const step = 10;
    const ticks = Array.from({ length: Y_AXIS_TICK_COUNT }, (_, k) => yMin + k * step);
    return { yMin, yMax: yMin + G * step, ticks };
  }

  const pad = Math.max((hi - lo) * 0.12, 1);
  const hiP = Math.max(hi + pad, 0);

  /**
   * Shallow drawdowns (worst period roughly −10% … −18%): a symmetric `loP` plus
   * `Math.floor(loP / step) * step` snaps the axis to −50% when positives are large
   * (step 50). Pin the floor at −20% and derive step from span to `hiP` instead.
   */
  const MILD_WORST_RETURN_PCT = -18;
  if (lo >= MILD_WORST_RETURN_PCT) {
    const yMin = -20;
    let step = niceStep((hiP - yMin) / G);
    if (!Number.isFinite(step) || step <= 0) step = 5;
    let yMax = yMin + G * step;
    let guard = 0;
    while (yMax < hiP - 1e-9 && guard++ < 80) {
      const bumped = niceStep(step * 1.15);
      step = bumped <= step ? step * 2 : bumped;
      yMax = yMin + G * step;
    }
    const ticks = Array.from({ length: Y_AXIS_TICK_COUNT }, (_, k) => yMin + k * step);
    return { yMin, yMax, ticks };
  }

  const loP = Math.min(lo - pad, 0);
  const spanNeed = Math.max(hiP - loP, 1e-6);

  let step = niceStep(spanNeed / G);
  if (!Number.isFinite(step) || step <= 0) step = 5;

  let yMin = Math.floor(loP / step) * step;
  let yMax = yMin + G * step;
  let guard = 0;
  while (yMax < hiP - 1e-9 && guard++ < 80) {
    const bumped = niceStep(step * 1.15);
    step = bumped <= step ? step * 2 : bumped;
    yMin = Math.floor(loP / step) * step;
    yMax = yMin + G * step;
  }

  guard = 0;
  while (yMin > loP + 1e-9 && guard++ < 80) {
    yMin -= step;
    yMax -= step;
  }

  guard = 0;
  while (yMax < hiP - 1e-9 && guard++ < 80) {
    yMin += step;
    yMax += step;
  }

  const ticks = Array.from({ length: Y_AXIS_TICK_COUNT }, (_, k) => yMin + k * step);
  return { yMin, yMax, ticks };
}

/** Clickable legend badge — same pattern as the Fear & Greed index chart legend. */
function ReturnsLegendBadge({
  label,
  swatch,
  swatchVariant = "solid",
  pressed,
  onToggle,
}: {
  label: string;
  swatch?: string;
  swatchVariant?: "solid" | "upDown";
  pressed: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={pressed}
      className={cn(
        "inline-flex h-6 max-w-full min-w-0 items-center gap-2 overflow-hidden rounded-[8px] border border-stroke bg-surface px-3 py-0 text-[12px] font-medium leading-none text-fg shadow-[0px_1px_2px_0px_rgba(var(--fs-shadow-rgb),var(--fs-shadow-a-04))] transition-opacity",
        !pressed && "opacity-40",
      )}
    >
      {swatchVariant === "upDown" ? (
        <PortfolioUpDownLegendSwatch />
      ) : (
        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: swatch }} aria-hidden />
      )}
      <span className="min-w-0 truncate">{label}</span>
    </button>
  );
}

function tickTopPercent(tick: number, yMin: number, yMax: number): number {
  const insetTop = FUNDAMENTALS_CHART_PLOT_INSET_TOP_FRAC * 100;
  const insetBottom = FUNDAMENTALS_CHART_PLOT_INSET_BOTTOM_FRAC * 100;
  const band = 100 - insetTop - insetBottom;
  const span = yMax - yMin;
  if (span <= 0) return insetTop + band / 2;
  return insetTop + ((yMax - tick) / span) * band;
}

/** Loading UI aligned with {@link DynamicsSvg}: dot grid, right Y-axis, negative band, bar slots. */
function ReturnsDynamicsChartSkeleton() {
  const barCount = 6;
  /** Pixel heights from baseline — scaled for {@link CHART_PLOT_HEIGHT_PX} plot. */
  const barHeightsPx = [119, 162, 96, 186, 126, 140];
  return (
    <div className="chart-skeleton-shimmer w-full" role="presentation" aria-hidden>
      <div style={{ height: CHART_TOTAL_HEIGHT_PX }}>
        <div className="flex w-full min-w-0" style={{ height: CHART_PLOT_HEIGHT_PX }}>
          <div className="relative min-w-0 flex-1">
            <div
              className={cn(
                "pointer-events-none absolute inset-x-0 z-0 bg-panel",
                CHART_PLOT_BACKDROP_INSET_CLASS,
              )}
            >
              <div className={CHART_PLOT_DOTS_PATTERN_CLASS} />
            </div>
            <div
              className={cn(
                "pointer-events-none absolute inset-x-0 rounded-sm",
                CHART_PLOT_BACKDROP_INSET_CLASS,
                NEGATIVE_ZONE_CLASS,
              )}
              style={{ top: "52%" }}
            />
            <div
              className={cn(
                "absolute inset-x-2 flex items-end justify-between gap-0.5",
                CHART_PLOT_BACKDROP_INSET_CLASS,
              )}
            >
              {Array.from({ length: barCount }).map((_, i) => (
                <div
                  key={i}
                  className="skeleton w-full max-w-[36px] rounded-t-[2px]"
                  style={{ height: barHeightsPx[i % barHeightsPx.length] }}
                />
              ))}
            </div>
          </div>
          <div
            className={cn("relative shrink-0", FUNDAMENTALS_CHART_Y_AXIS_PADDING_CLASS)}
            style={{ width: FUNDAMENTALS_CHART_Y_AXIS_W_PX }}
          >
            <div className={cn("pointer-events-none absolute inset-x-0", CHART_PLOT_BACKDROP_INSET_CLASS)}>
              {Array.from({ length: Y_AXIS_TICK_COUNT }).map((_, i) => (
                <div
                  key={i}
                  className="skeleton absolute right-0 h-2.5 w-9 -translate-y-1/2 rounded-sm"
                  style={{ top: `${tickTopPercent(30 - i * 10, -20, 30)}%` }}
                />
              ))}
            </div>
          </div>
        </div>
        <div className="flex pt-1.5" style={{ height: FUNDAMENTALS_CHART_AXIS_ROW_PX }}>
          <div className="grid min-w-0 flex-1 grid-cols-6 gap-1">
            {Array.from({ length: barCount }).map((_, i) => (
              <div key={i} className="flex justify-center">
                <div className="skeleton h-2 w-10 rounded-sm" />
              </div>
            ))}
          </div>
          <div className="shrink-0" style={{ width: FUNDAMENTALS_CHART_Y_AXIS_W_PX }} />
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-center gap-6">
        <div className="skeleton h-3 w-20 rounded-sm" />
        <div className="skeleton h-3 w-32 rounded-sm" />
      </div>
    </div>
  );
}

function DynamicsSvg({
  bars,
  showPortfolio,
  showSpy,
  showNasdaq,
  onTogglePortfolio,
  onToggleSpy,
  onToggleNasdaq,
}: {
  bars: PortfolioPeriodReturnBar[];
  showPortfolio: boolean;
  showSpy: boolean;
  showNasdaq: boolean;
  onTogglePortfolio: () => void;
  onToggleSpy: () => void;
  onToggleNasdaq: () => void;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const plotRef = useRef<HTMLDivElement>(null);
  const [plotWidth, setPlotWidth] = useState(640);
  const [hover, setHover] = useState<{ i: number; x: number; y: number } | null>(null);

  useEffect(() => {
    const el = plotRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const w = el.getBoundingClientRect().width;
      if (w > 0) setPlotWidth(Math.floor(w));
    });
    ro.observe(el);
    const w0 = el.getBoundingClientRect().width;
    if (w0 > 0) setPlotWidth(Math.floor(w0));
    return () => ro.disconnect();
  }, []);

  const padL = 8;
  const padR = 8;
  const padT = CHART_PLOT_HEIGHT_PX * FUNDAMENTALS_CHART_PLOT_INSET_TOP_FRAC;
  const padB = CHART_PLOT_HEIGHT_PX * FUNDAMENTALS_CHART_PLOT_INSET_BOTTOM_FRAC;
  const plotH = CHART_PLOT_HEIGHT_PX;
  const innerW = Math.max(120, plotWidth - padL - padR);
  const innerH = plotH - padT - padB;

  const values = useMemo(() => {
    const v: number[] = [];
    for (const b of bars) {
      if (showPortfolio && b.portfolioPct != null && Number.isFinite(b.portfolioPct)) {
        v.push(b.portfolioPct);
      }
      if (showSpy && b.benchmarkPct != null && Number.isFinite(b.benchmarkPct)) {
        v.push(b.benchmarkPct);
      }
      if (showNasdaq && b.nasdaqPct != null && Number.isFinite(b.nasdaqPct)) {
        v.push(b.nasdaqPct);
      }
    }
    return v;
  }, [bars, showPortfolio, showSpy, showNasdaq]);

  const { yMin, yMax, ticks } = niceYRange(values);

  const yFor = useCallback(
    (p: number) => padT + ((yMax - p) / (yMax - yMin)) * innerH,
    [yMax, yMin, innerH, padT],
  );

  const y0 = yFor(0);
  const n = Math.max(1, bars.length);
  const groupW = innerW / n;
  const seriesCount =
    (showPortfolio ? 1 : 0) + (showSpy ? 1 : 0) + (showNasdaq ? 1 : 0);
  const multi = seriesCount >= 2;
  const barW =
    seriesCount >= 3 ? Math.min(22, groupW * 0.22)
    : multi ? Math.min(28, groupW * 0.32)
    : Math.min(40, groupW * 0.55);
  const gap = seriesCount >= 3 ? groupW * 0.05 : multi ? groupW * 0.08 : groupW * 0.2;

  const groupLayout = useCallback(
    (b: PortfolioPeriodReturnBar, i: number) => {
      const gx = padL + i * groupW + groupW / 2;
      const hasP = showPortfolio && b.portfolioPct != null && Number.isFinite(b.portfolioPct);
      const hasS = showSpy && b.benchmarkPct != null && Number.isFinite(b.benchmarkPct);
      const hasN = showNasdaq && b.nasdaqPct != null && Number.isFinite(b.nasdaqPct);
      const count = (hasP ? 1 : 0) + (hasS ? 1 : 0) + (hasN ? 1 : 0);
      const pairW = count > 1 ? barW * count + gap * (count - 1) : barW;
      const startX = gx - pairW / 2;
      let x = startX;
      const slots: { key: string; x: number; value: number; color: string }[] = [];
      if (hasP) {
        slots.push({
          key: "p",
          x,
          value: b.portfolioPct!,
          color: portfolioReturnBarColor(b.portfolioPct!),
        });
        x += barW + gap;
      }
      if (hasS) {
        slots.push({ key: "s", x, value: b.benchmarkPct!, color: BENCHMARK_SPY_BAR });
        x += barW + gap;
      }
      if (hasN) {
        slots.push({ key: "n", x, value: b.nasdaqPct!, color: BENCHMARK_NASDAQ_BAR });
      }
      return slots;
    },
    [padL, groupW, showPortfolio, showSpy, showNasdaq, barW, gap],
  );

  const barValueLabels = useMemo(() => {
    const labels: { key: string; leftPx: number; topPx: number; text: string; below: boolean }[] = [];
    const gapPx = 4;
    const linePx = 12;
    for (let i = 0; i < bars.length; i++) {
      const slots = groupLayout(bars[i]!, i);
      for (const s of slots) {
        const below = s.value < 0;
        const atBar = yFor(s.value);
        let topPx = below ? atBar + gapPx : atBar - gapPx;
        if (below && topPx + linePx > plotH) {
          topPx = Math.max(atBar + 2, plotH - linePx);
        }
        labels.push({
          key: `${s.key}-${i}`,
          leftPx: s.x + barW / 2,
          topPx,
          text: formatPctAxis(s.value),
          below,
        });
      }
    }
    return labels;
  }, [bars, groupLayout, barW, yFor, plotH]);

  const updateHoverFromEvent = useCallback((i: number, clientX: number, clientY: number) => {
    const el = wrapRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setHover({ i, x: clientX - r.left, y: clientY - r.top });
  }, []);

  const hoveredBar = hover != null ? bars[hover.i] : null;

  const legend = (
    <>
      <ReturnsLegendBadge
        label="Portfolio"
        swatchVariant="upDown"
        pressed={showPortfolio}
        onToggle={onTogglePortfolio}
      />
      <ReturnsLegendBadge
        label={BENCHMARK_SPY_LABEL}
        swatch={BENCHMARK_SPY_BAR}
        pressed={showSpy}
        onToggle={onToggleSpy}
      />
      <ReturnsLegendBadge
        label={BENCHMARK_NASDAQ_LABEL}
        swatch={BENCHMARK_NASDAQ_BAR}
        pressed={showNasdaq}
        onToggle={onToggleNasdaq}
      />
    </>
  );

  return (
    <div ref={wrapRef} className="relative w-full" onPointerLeave={() => setHover(null)}>
      <div
        style={{ height: CHART_TOTAL_HEIGHT_PX }}
        role="img"
        aria-label="Portfolio and benchmark period returns"
      >
        <div className="flex min-h-0 w-full overflow-visible" style={{ height: CHART_PLOT_HEIGHT_PX }}>
          <div ref={plotRef} className="relative min-h-0 min-w-0 flex-1 overflow-visible">
            <div
              className={cn(
                "pointer-events-none absolute inset-x-0 z-0 bg-panel",
                CHART_PLOT_BACKDROP_INSET_CLASS,
              )}
              aria-hidden
            >
              <div className={CHART_PLOT_DOTS_PATTERN_CLASS} />
            </div>

            <svg
              width={plotWidth}
              height={plotH}
              className="relative z-[1] max-w-full"
              aria-hidden
            >
              <title>Portfolio and benchmark period returns</title>
              <rect
                x={padL}
                y={y0}
                width={innerW}
                height={Math.max(0, padT + innerH - y0)}
                className={NEGATIVE_ZONE_FILL_CLASS}
              />
              <line
                x1={padL}
                x2={padL + innerW}
                y1={y0}
                y2={y0}
                stroke={FUNDAMENTALS_CHART_ZERO_BASELINE_BORDER}
                strokeWidth={1}
              />

              {hover != null ? (
                <rect
                  x={padL + hover.i * groupW}
                  y={padT}
                  width={groupW}
                  height={innerH}
                  fill={FUNDAMENTALS_CHART_HOVER_BAND_BG}
                />
              ) : null}

              {bars.map((b, i) => {
                const slots = groupLayout(b, i);
                const els: ReactNode[] = slots.map((s) => {
                  const y1 = yFor(s.value);
                  const up = y1 < y0;
                  const hPix = Math.max(1, Math.abs(y0 - y1));
                  const yTop = up ? y1 : y0;
                  return (
                    <rect
                      key={s.key}
                      x={s.x}
                      y={yTop}
                      width={barW}
                      height={hPix}
                      rx={2}
                      ry={2}
                      fill={s.color}
                    />
                  );
                });
                return <g key={`${b.periodStart}-${b.periodEnd}`}>{els}</g>;
              })}

              {bars.map((b, i) => {
                const xHit = padL + i * groupW;
                return (
                  <rect
                    key={`hit-${b.periodStart}-${b.periodEnd}`}
                    x={xHit}
                    y={0}
                    width={groupW}
                    height={plotH}
                    fill="transparent"
                    className="cursor-crosshair"
                    onPointerEnter={(e) => updateHoverFromEvent(i, e.clientX, e.clientY)}
                    onPointerMove={(e) => updateHoverFromEvent(i, e.clientX, e.clientY)}
                  />
                );
              })}
            </svg>

            {barValueLabels.map((b) => (
              <div
                key={b.key}
                className="pointer-events-none absolute z-[15] max-w-[5.5rem] truncate text-center text-[11px] font-semibold leading-none tabular-nums text-fg"
                style={{
                  left: b.leftPx,
                  top: b.topPx,
                  transform: b.below ? "translate(-50%, 0)" : "translate(-50%, -100%)",
                  textShadow: "var(--fs-chart-value-label-shadow)",
                }}
                title={b.text}
              >
                {b.text}
              </div>
            ))}

            {hoveredBar != null && hover != null ? (
              <div
                role="tooltip"
                className={cn(FUNDAMENTALS_CHART_TOOLTIP_CLASS, "z-20")}
                style={{
                  left: hover.x,
                  top: hover.y,
                  transform: "translate(-50%, calc(-100% - 10px))",
                }}
              >
                <p className="text-[12px] font-semibold leading-4 text-fg">{hoveredBar.label}</p>
                {showPortfolio ? (
                  <p className="mt-1.5 text-[12px] leading-4 text-fg-muted">
                    <span
                      className="font-semibold"
                      style={{
                        color: portfolioReturnBarColor(hoveredBar.portfolioPct ?? 0),
                      }}
                    >
                      Portfolio
                    </span>
                    <span className="tabular-nums text-fg">
                      {" "}
                      {formatTooltipPct(hoveredBar.portfolioPct)}
                    </span>
                  </p>
                ) : null}
                {showSpy ? (
                  <p className={cn("text-[12px] leading-4 text-fg-muted", showPortfolio ? "mt-0.5" : "mt-1.5")}>
                    <span className="font-semibold" style={{ color: BENCHMARK_SPY_BAR }}>
                      {BENCHMARK_SPY_LABEL}
                    </span>
                    <span className="tabular-nums text-fg">
                      {" "}
                      {formatTooltipPct(hoveredBar.benchmarkPct)}
                    </span>
                  </p>
                ) : null}
                {showNasdaq ? (
                  <p
                    className={cn(
                      "text-[12px] leading-4 text-fg-muted",
                      showPortfolio || showSpy ? "mt-0.5" : "mt-1.5",
                    )}
                  >
                    <span className="font-semibold" style={{ color: BENCHMARK_NASDAQ_BAR }}>
                      {BENCHMARK_NASDAQ_LABEL}
                    </span>
                    <span className="tabular-nums text-fg">
                      {" "}
                      {formatTooltipPct(hoveredBar.nasdaqPct)}
                    </span>
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>

          <div
            className={cn(
              "relative h-full shrink-0 text-right font-['Inter'] text-[12px] tabular-nums leading-none text-fg-muted",
              FUNDAMENTALS_CHART_Y_AXIS_PADDING_CLASS,
            )}
            style={{ width: FUNDAMENTALS_CHART_Y_AXIS_W_PX }}
            aria-hidden
          >
            <div className={cn("pointer-events-none absolute inset-x-0", CHART_PLOT_BACKDROP_INSET_CLASS)}>
              {ticks.map((t) => (
                <span
                  key={t}
                  className="absolute right-0 z-[1] block -translate-y-1/2 rounded-sm bg-panel px-0.5 py-px"
                  style={{ top: `${tickTopPercent(t, yMin, yMax)}%` }}
                >
                  {formatPctAxis(t)}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div
          className="flex w-full shrink-0 pt-1.5"
          style={{ height: FUNDAMENTALS_CHART_AXIS_ROW_PX }}
        >
          <div className="relative min-w-0 flex-1 overflow-visible">
            {bars.map((b, i) => {
              const leftPct = ((i + 0.5) / n) * 100;
              const label =
                b.label.length > 14 && bars.length > 8 ? `${b.label.slice(0, 11)}…` : b.label;
              const rotate = bars.length > 16;
              return (
                <div
                  key={`axis-${b.periodStart}-${b.periodEnd}`}
                  className="absolute bottom-0 flex min-h-0 -translate-x-1/2 items-end justify-center overflow-visible px-0.5 pb-0.5"
                  style={{ left: `${leftPct}%` }}
                  title={b.label}
                >
                  <span
                    className="inline-block whitespace-nowrap font-['Inter'] text-[11px] font-normal tabular-nums leading-none text-fg-muted sm:text-[12px]"
                    style={
                      rotate
                        ? {
                            transform: `rotate(${FUNDAMENTALS_CHART_AXIS_LABEL_ROTATE_DEG}deg)`,
                            transformOrigin: "center bottom",
                          }
                        : undefined
                    }
                  >
                    {label}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="shrink-0" style={{ width: FUNDAMENTALS_CHART_Y_AXIS_W_PX }} aria-hidden />
        </div>
      </div>

      <div className="mt-3 hidden flex-wrap items-center justify-center gap-2 sm:flex">{legend}</div>
    </div>
  );
}

function PortfolioReturnsDynamicsChartInner({
  transactions,
  canLoad,
}: {
  transactions: PortfolioTransaction[];
  canLoad: boolean;
}) {
  const [granularity, setGranularity] = useState<PeriodReturnGranularity>("annually");
  const [selectedYear, setSelectedYear] = useState(() => new Date().getFullYear());
  const [showPortfolio, setShowPortfolio] = useState(true);
  const [compareSpy, setCompareSpy] = useState(true);
  const [compareNasdaq, setCompareNasdaq] = useState(false);
  const [bars, setBars] = useState<PortfolioPeriodReturnBar[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loadGenRef = useRef(0);

  const availableYears = useMemo(
    () => portfolioPeriodReturnYears(transactions),
    [transactions],
  );
  const yearTabItems = useMemo(
    (): SecondaryTabItem<string>[] =>
      availableYears.map((y) => ({ id: String(y), label: String(y) })),
    [availableYears],
  );
  const showYearTabs = canLoad && granularity !== "annually" && yearTabItems.length > 0;

  useEffect(() => {
    if (availableYears.length === 0) return;
    if (!availableYears.includes(selectedYear)) {
      const last = latestPeriodReturnYear(availableYears);
      if (last != null) setSelectedYear(last);
    }
  }, [availableYears, selectedYear]);

  const applyGranularity = useCallback(
    (next: PeriodReturnGranularity) => {
      if (granularity === "annually" && next !== "annually") {
        const last = latestPeriodReturnYear(availableYears);
        if (last != null) setSelectedYear(last);
      }
      setGranularity(next);
    },
    [availableYears, granularity],
  );

  // At least one series stays visible (same guard as the Fear & Greed legend badges).
  const togglePortfolio = useCallback(() => {
    setShowPortfolio((cur) => {
      if (cur && !compareSpy && !compareNasdaq) return cur;
      return !cur;
    });
  }, [compareSpy, compareNasdaq]);

  const toggleSpy = useCallback(() => {
    setCompareSpy((cur) => {
      if (cur && !showPortfolio && !compareNasdaq) return cur;
      return !cur;
    });
  }, [showPortfolio, compareNasdaq]);

  const toggleNasdaq = useCallback(() => {
    setCompareNasdaq((cur) => {
      if (cur && !showPortfolio && !compareSpy) return cur;
      return !cur;
    });
  }, [showPortfolio, compareSpy]);

  const load = useCallback(async () => {
    if (!canLoad) {
      setBars([]);
      return;
    }
    const gen = ++loadGenRef.current;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/portfolio/period-returns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          transactions,
          granularity,
          benchmark: "SPY",
          ...(granularity === "annually" ? {} : { year: selectedYear }),
        }),
      });
      if (!res.ok) throw new Error("Failed to load");
      const json = (await res.json()) as { bars?: PortfolioPeriodReturnBar[] };
      if (gen !== loadGenRef.current) return;
      setBars(Array.isArray(json.bars) ? json.bars : []);
    } catch {
      if (gen !== loadGenRef.current) return;
      setError("Could not load period returns");
      setBars([]);
    } finally {
      if (gen === loadGenRef.current) setLoading(false);
    }
  }, [canLoad, transactions, granularity, selectedYear]);

  useEffect(() => {
    void load();
  }, [load]);

  const hasRenderable = bars.some(
    (b) =>
      (b.portfolioPct != null && Number.isFinite(b.portfolioPct)) ||
      (b.benchmarkPct != null && Number.isFinite(b.benchmarkPct)) ||
      (b.nasdaqPct != null && Number.isFinite(b.nasdaqPct)),
  );

  const chartBars = useMemo(() => {
    if (granularity === "annually") return bars;
    return bars.map((b) => ({
      ...b,
      label: periodReturnBarLabelForYear(b.periodStart, granularity),
    }));
  }, [bars, granularity]);

  return (
    <section className="mb-10 w-full min-w-0">
      <div className="mb-4 flex flex-col gap-3">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="flex min-w-0 items-start justify-between gap-3">
            <h2 className={cn("min-w-0 shrink", STOCK_OVERVIEW_SECTION_HEADING_CLASS)}>
              Returns
            </h2>
          </div>

          <div className="flex min-w-0 flex-col items-stretch gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
            <div className="hidden min-w-0 items-center gap-3 sm:flex">
              <div className="max-w-full min-w-0 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                <TabSwitcher
                  aria-label="Return period"
                  className="w-max min-w-0 justify-end"
                  options={GRANULARITY_OPTIONS}
                  value={granularity}
                  onChange={applyGranularity}
                />
              </div>
            </div>
          </div>
        </div>

        {showYearTabs ? (
          <SecondaryTabs
            aria-label="Return year"
            items={yearTabItems}
            value={String(selectedYear)}
            onValueChange={(id) => setSelectedYear(Number(id))}
          />
        ) : null}
      </div>

      <div className="w-full min-w-0">
        {!canLoad ? (
          <Empty variant="plain" className="min-h-[320px] justify-center py-0">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <LineChart className="h-6 w-6" strokeWidth={1.75} aria-hidden />
              </EmptyMedia>
              <EmptyTitle>No activity yet</EmptyTitle>
              <EmptyDescription className="max-w-sm">
                Add trades or cash movements to compare your period returns with a benchmark.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : loading ? (
          <ReturnsDynamicsChartSkeleton />
        ) : error ? (
          <div className="flex min-h-[320px] flex-col items-center justify-center px-6">
            <p className="text-sm text-fg-muted">{error}</p>
          </div>
        ) : !hasRenderable ? (
          <Empty variant="plain" className="min-h-[320px] justify-center py-0">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <LineChart className="h-6 w-6" strokeWidth={1.75} aria-hidden />
              </EmptyMedia>
              <EmptyTitle>Not enough data</EmptyTitle>
              <EmptyDescription className="max-w-sm">
                Try a wider period or add more history to see annual or quarterly bars.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <DynamicsSvg
            bars={chartBars}
            showPortfolio={showPortfolio}
            showSpy={compareSpy}
            showNasdaq={compareNasdaq}
            onTogglePortfolio={togglePortfolio}
            onToggleSpy={toggleSpy}
            onToggleNasdaq={toggleNasdaq}
          />
        )}
      </div>

      {/* Mobile: show period switcher below chart */}
      <div className="mt-3 w-full min-w-0 sm:hidden">
        <TabSwitcher
          aria-label="Return period"
          fullWidth
          className="w-full min-w-0"
          options={GRANULARITY_OPTIONS}
          value={granularity}
          onChange={applyGranularity}
        />
      </div>

      {/* Mobile: legend below tabs (tabs should be above legend). */}
      {canLoad && !loading && !error && hasRenderable ? (
        <div className="mt-3 flex flex-wrap items-center justify-center gap-2 sm:hidden">
          <ReturnsLegendBadge
            label="Portfolio"
            swatchVariant="upDown"
            pressed={showPortfolio}
            onToggle={togglePortfolio}
          />
          <ReturnsLegendBadge
            label={BENCHMARK_SPY_LABEL}
            swatch={BENCHMARK_SPY_BAR}
            pressed={compareSpy}
            onToggle={toggleSpy}
          />
          <ReturnsLegendBadge
            label={BENCHMARK_NASDAQ_LABEL}
            swatch={BENCHMARK_NASDAQ_BAR}
            pressed={compareNasdaq}
            onToggle={toggleNasdaq}
          />
        </div>
      ) : null}
    </section>
  );
}

export const PortfolioReturnsDynamicsChart = memo(PortfolioReturnsDynamicsChartInner);
