"use client";

import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { LineChart, Settings } from "@/lib/icons";

import { TabSwitcher, type TabSwitcherOption } from "@/components/design-system";
import {
  dropdownMenuPanelClassName,
  dropdownMenuPlainItemRowClassName,
} from "@/components/design-system/dropdown-menu-styles";
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
import { cn } from "@/lib/utils";

const PORTFOLIO_BAR = "#2563EB";
const BENCHMARK_BAR = "#EA580C";
const NEGATIVE_ZONE = "rgba(254, 242, 242, 0.92)";

/** Total chart height — plot band plus slanted period labels (matches Charting). */
const CHART_TOTAL_HEIGHT_PX = 320;
const CHART_PLOT_HEIGHT_PX = CHART_TOTAL_HEIGHT_PX - FUNDAMENTALS_CHART_AXIS_ROW_PX;
const CHART_PLOT_BACKDROP_INSET_CLASS = "top-[8%] bottom-[4%]";
/** Always six labeled ticks on the Y axis (five equal steps). */
const Y_AXIS_TICK_COUNT = 6;
const Y_AXIS_STEP_COUNT = Y_AXIS_TICK_COUNT - 1;

const GRANULARITY_OPTIONS: TabSwitcherOption<PeriodReturnGranularity>[] = [
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "annually", label: "Annually" },
];

const BENCHMARK_SPY_LABEL = "S&P 500";
const BENCHMARK_TICKER = "SPY";

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

function PillSwitch({
  pressed,
  onPressedChange,
  "aria-label": ariaLabel,
}: {
  pressed: boolean;
  onPressedChange: (next: boolean) => void;
  "aria-label": string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={pressed}
      aria-label={ariaLabel}
      onClick={() => onPressedChange(!pressed)}
      className={cn(
        "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#09090B]/15",
        pressed ? "bg-[#2563EB]" : "bg-[#E4E4E7]",
      )}
    >
      <span
        className={cn(
          "pointer-events-none absolute left-0.5 top-1/2 h-4 w-4 -translate-y-1/2 rounded-full bg-white shadow-sm transition-transform",
          pressed ? "translate-x-4" : "translate-x-0",
        )}
      />
    </button>
  );
}

const RETURNS_DYNAMICS_SETTINGS_MENU_Z = 120;

function ReturnsDynamicsSettingsButton({
  compareSpy,
  onCompareSpyChange,
}: {
  compareSpy: boolean;
  onCompareSpyChange: (next: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const [portalMounted, setPortalMounted] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState<{ top: number; left: number; width: number } | null>(
    null,
  );
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setPortalMounted(true);
  }, []);

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) {
      setMenuAnchor(null);
      return;
    }
    const update = () => {
      const rect = triggerRef.current!.getBoundingClientRect();
      setMenuAnchor({
        top: rect.bottom + 4,
        left: rect.left,
        width: Math.min(window.innerWidth - 32, 280),
      });
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      e.preventDefault();
      setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => document.removeEventListener("pointerdown", onPointerDown, true);
  }, [open]);

  const menuPanel =
    open && menuAnchor && portalMounted ?
      createPortal(
        <div
          ref={menuRef}
          className={dropdownMenuPanelClassName("fixed")}
          style={{
            top: menuAnchor.top,
            left: menuAnchor.left,
            width: menuAnchor.width,
            zIndex: RETURNS_DYNAMICS_SETTINGS_MENU_Z,
          }}
          role="menu"
          aria-label="Return dynamics settings"
        >
          <div role="menuitem" className={dropdownMenuPlainItemRowClassName()}>
            <span className="min-w-0 flex-1 text-sm font-medium leading-5 text-[#09090B]">
              Compare to S&amp;P 500
            </span>
            <PillSwitch
              pressed={compareSpy}
              onPressedChange={onCompareSpyChange}
              aria-label="Compare portfolio returns to S&P 500"
            />
          </div>
        </div>,
        document.body,
      )
    : null;

  return (
    <>
      {menuPanel}
      <div className="relative z-20 shrink-0">
        <button
          ref={triggerRef}
          type="button"
          aria-label="Return dynamics settings"
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className={cn(
            "inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-[10px] border border-[#E4E4E7] bg-white text-[#09090B]",
            "shadow-[0px_1px_2px_0px_rgba(10,10,10,0.06)] transition-all duration-100",
            "hover:bg-[#F4F4F5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#09090B]/15 focus-visible:ring-offset-2",
            open && "bg-[#F4F4F5]",
          )}
        >
          <Settings className="h-5 w-5 shrink-0" strokeWidth={2} aria-hidden />
        </button>
      </div>
    </>
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
                "pointer-events-none absolute inset-x-0 z-0 bg-white",
                CHART_PLOT_BACKDROP_INSET_CLASS,
              )}
            >
              <div className={CHART_PLOT_DOTS_PATTERN_CLASS} />
            </div>
            <div
              className={cn(
                "pointer-events-none absolute inset-x-0 rounded-sm",
                CHART_PLOT_BACKDROP_INSET_CLASS,
              )}
              style={{ background: NEGATIVE_ZONE, top: "52%" }}
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
  showBenchmark,
  benchmarkLabel,
}: {
  bars: PortfolioPeriodReturnBar[];
  showBenchmark: boolean;
  benchmarkLabel: string;
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
      if (b.portfolioPct != null && Number.isFinite(b.portfolioPct)) v.push(b.portfolioPct);
      if (showBenchmark && b.benchmarkPct != null && Number.isFinite(b.benchmarkPct)) {
        v.push(b.benchmarkPct);
      }
    }
    return v;
  }, [bars, showBenchmark]);

  const { yMin, yMax, ticks } = niceYRange(values);

  const yFor = useCallback(
    (p: number) => padT + ((yMax - p) / (yMax - yMin)) * innerH,
    [yMax, yMin, innerH, padT],
  );

  const y0 = yFor(0);
  const n = Math.max(1, bars.length);
  const groupW = innerW / n;
  const barW = showBenchmark ? Math.min(28, groupW * 0.32) : Math.min(40, groupW * 0.55);
  const gap = showBenchmark ? groupW * 0.08 : groupW * 0.2;

  const barValueLabels = useMemo(() => {
    const labels: { key: string; leftPx: number; topPx: number; text: string }[] = [];
    for (let i = 0; i < bars.length; i++) {
      const b = bars[i]!;
      const gx = padL + i * groupW + groupW / 2;
      const p = b.portfolioPct;
      const bench = b.benchmarkPct;
      const hasP = p != null && Number.isFinite(p);
      const hasB = showBenchmark && bench != null && Number.isFinite(bench);
      const pairW = hasB ? barW * 2 + gap : barW;
      const startX = gx - pairW / 2;

      if (hasP && p! >= 0) {
        labels.push({
          key: `p-${i}`,
          leftPx: startX + barW / 2,
          topPx: yFor(p!) - 4,
          text: formatPctAxis(p!),
        });
      }
      if (hasB && bench! >= 0) {
        labels.push({
          key: `b-${i}`,
          leftPx: startX + barW + gap + barW / 2,
          topPx: yFor(bench!) - 4,
          text: formatPctAxis(bench!),
        });
      }
    }
    return labels;
  }, [bars, showBenchmark, padL, groupW, barW, gap, yFor]);

  const updateHoverFromEvent = useCallback((i: number, clientX: number, clientY: number) => {
    const el = wrapRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setHover({ i, x: clientX - r.left, y: clientY - r.top });
  }, []);

  const hoveredBar = hover != null ? bars[hover.i] : null;

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
                "pointer-events-none absolute inset-x-0 z-0 bg-white",
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
                fill={NEGATIVE_ZONE}
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
                const gx = padL + i * groupW + groupW / 2;
                const p = b.portfolioPct;
                const bench = b.benchmarkPct;
                const hasP = p != null && Number.isFinite(p);
                const hasB = showBenchmark && bench != null && Number.isFinite(bench);
                const pairW = hasB ? barW * 2 + gap : barW;
                const startX = gx - pairW / 2;

                const els: ReactNode[] = [];
                if (hasP) {
                  const y1 = yFor(p!);
                  const up = y1 < y0;
                  const hPix = Math.max(1, Math.abs(y0 - y1));
                  const yTop = up ? y1 : y0;
                  els.push(
                    <rect
                      key="p"
                      x={startX}
                      y={yTop}
                      width={barW}
                      height={hPix}
                      rx={2}
                      ry={2}
                      fill={PORTFOLIO_BAR}
                    />,
                  );
                }
                if (hasB) {
                  const y1b = yFor(bench!);
                  const upB = y1b < y0;
                  const hPixB = Math.max(1, Math.abs(y0 - y1b));
                  const yTopB = upB ? y1b : y0;
                  els.push(
                    <rect
                      key="b"
                      x={startX + barW + gap}
                      y={yTopB}
                      width={barW}
                      height={hPixB}
                      rx={2}
                      ry={2}
                      fill={BENCHMARK_BAR}
                    />,
                  );
                }

                return (
                  <g key={`${b.periodStart}-${b.periodEnd}`}>{els}</g>
                );
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
                className="pointer-events-none absolute z-[15] max-w-[5.5rem] truncate text-center text-[11px] font-semibold leading-none tabular-nums text-[#09090B]"
                style={{
                  left: b.leftPx,
                  top: b.topPx,
                  transform: "translate(-50%, -100%)",
                  textShadow: "0 0 3px rgba(255,255,255,0.95), 0 1px 2px rgba(255,255,255,0.8)",
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
                <p className="text-[12px] font-semibold leading-4 text-[#09090B]">{hoveredBar.label}</p>
                <p className="mt-1.5 text-[12px] leading-4 text-[#71717A]">
                  <span className="font-semibold" style={{ color: PORTFOLIO_BAR }}>
                    Portfolio
                  </span>
                  <span className="tabular-nums text-[#09090B]">
                    {" "}
                    {formatTooltipPct(hoveredBar.portfolioPct)}
                  </span>
                </p>
                {showBenchmark ? (
                  <p className="mt-0.5 text-[12px] leading-4 text-[#71717A]">
                    <span className="font-semibold" style={{ color: BENCHMARK_BAR }}>
                      {benchmarkLabel}
                    </span>
                    <span className="tabular-nums text-[#09090B]">
                      {" "}
                      {formatTooltipPct(hoveredBar.benchmarkPct)}
                    </span>
                  </p>
                ) : null}
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
            <div className={cn("pointer-events-none absolute inset-x-0", CHART_PLOT_BACKDROP_INSET_CLASS)}>
              {ticks.map((t) => (
                <span
                  key={t}
                  className="absolute right-0 z-[1] block -translate-y-1/2 rounded-sm bg-white px-0.5 py-px"
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
                    className="inline-block whitespace-nowrap font-['Inter'] text-[11px] font-normal tabular-nums leading-none text-[#71717A] sm:text-[12px]"
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

      <div className="mt-3 hidden flex-wrap items-center justify-center gap-6 text-xs font-medium text-[#71717A] sm:flex">
        <span className="inline-flex items-center gap-2">
          <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: PORTFOLIO_BAR }} />
          Portfolio
        </span>
        {showBenchmark ? (
          <span className="inline-flex items-center gap-2">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: BENCHMARK_BAR }} />
            {benchmarkLabel}
          </span>
        ) : null}
      </div>
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
  const [compareSpy, setCompareSpy] = useState(true);
  const [bars, setBars] = useState<PortfolioPeriodReturnBar[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const settingsProps = {
    compareSpy,
    onCompareSpyChange: setCompareSpy,
  };

  const load = useCallback(async () => {
    if (!canLoad) {
      setBars([]);
      return;
    }
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
          benchmark: BENCHMARK_TICKER,
        }),
      });
      if (!res.ok) throw new Error("Failed to load");
      const json = (await res.json()) as { bars?: PortfolioPeriodReturnBar[] };
      setBars(Array.isArray(json.bars) ? json.bars : []);
    } catch {
      setError("Could not load period returns");
      setBars([]);
    } finally {
      setLoading(false);
    }
  }, [canLoad, transactions, granularity]);

  useEffect(() => {
    void load();
  }, [load]);

  const hasRenderable = bars.some(
    (b) =>
      (b.portfolioPct != null && Number.isFinite(b.portfolioPct)) ||
      (b.benchmarkPct != null && Number.isFinite(b.benchmarkPct)),
  );

  return (
    <section className="mb-10 w-full min-w-0">
      <div className="mb-4 flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="flex min-w-0 items-start justify-between gap-3">
          <h2 className="min-w-0 shrink text-2xl font-semibold leading-9 tracking-tight text-[#09090B]">
            Dynamics of portfolio returns
          </h2>
          {/* Mobile: settings on the title line. */}
          <div className="flex shrink-0 items-center sm:hidden">
            <ReturnsDynamicsSettingsButton {...settingsProps} />
          </div>
        </div>

        <div className="flex min-w-0 flex-col items-stretch gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
          <div className="hidden min-w-0 items-center gap-3 sm:flex">
            <ReturnsDynamicsSettingsButton {...settingsProps} />
            <div className="max-w-full min-w-0 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <TabSwitcher
                aria-label="Return period"
                className="w-max min-w-0 justify-end"
                options={GRANULARITY_OPTIONS}
                value={granularity}
                onChange={setGranularity}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="w-full min-w-0">
        {!canLoad ? (
          <Empty variant="plain" className="min-h-[320px] justify-center py-0">
            <EmptyHeader className="gap-2">
              <EmptyMedia variant="icon">
                <LineChart className="h-6 w-6" strokeWidth={1.75} aria-hidden />
              </EmptyMedia>
              <EmptyTitle className="text-sm font-medium leading-5">No activity yet</EmptyTitle>
              <EmptyDescription className="max-w-sm">
                Add trades or cash movements to compare your period returns with a benchmark.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : loading ? (
          <ReturnsDynamicsChartSkeleton />
        ) : error ? (
          <div className="flex min-h-[320px] flex-col items-center justify-center px-6">
            <p className="text-sm text-[#71717A]">{error}</p>
          </div>
        ) : !hasRenderable ? (
          <Empty variant="plain" className="min-h-[320px] justify-center py-0">
            <EmptyHeader className="gap-2">
              <EmptyMedia variant="icon">
                <LineChart className="h-6 w-6" strokeWidth={1.75} aria-hidden />
              </EmptyMedia>
              <EmptyTitle className="text-sm font-medium leading-5">Not enough data</EmptyTitle>
              <EmptyDescription className="max-w-sm">
                Try a wider period or add more history to see annual or quarterly bars.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <DynamicsSvg
            bars={bars}
            showBenchmark={compareSpy}
            benchmarkLabel={BENCHMARK_SPY_LABEL}
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
          onChange={setGranularity}
        />
      </div>

      {/* Mobile: legend below tabs (tabs should be above legend). */}
      {canLoad && !loading && !error && hasRenderable ? (
        <div className="mt-3 flex flex-wrap items-center justify-center gap-6 text-xs font-medium text-[#71717A] sm:hidden">
          <span className="inline-flex items-center gap-2">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: PORTFOLIO_BAR }} />
            Portfolio
          </span>
          {compareSpy ? (
            <span className="inline-flex items-center gap-2">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: BENCHMARK_BAR }} />
              {BENCHMARK_SPY_LABEL}
            </span>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

export const PortfolioReturnsDynamicsChart = memo(PortfolioReturnsDynamicsChartInner);
