"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BarChart3, Check, ChevronDown } from "@/lib/icons";

import { CHART_PLOT_DOTS_PATTERN_CLASS } from "@/components/chart/overview-bottom-axis";
import {
  dropdownMenuMobileSheetBodyClassName,
  dropdownMenuPlainItemRowClassName,
} from "@/components/design-system/dropdown-menu-styles";
import { MobileBottomSheet } from "@/components/ui/mobile-bottom-sheet";
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
  eachMonthOfInterval,
  eachYearOfInterval,
  endOfMonth,
  format,
  isAfter,
  max as maxDate,
  min as minDate,
  parseISO,
  startOfMonth,
  startOfYear,
  subMonths,
  subYears,
} from "date-fns";

import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { cn } from "@/lib/utils";
import type { PortfolioTransaction } from "@/components/portfolio/portfolio-types";

/** Figma Color/Blue/600 + Color/Orange/600 (Charting bar pair). */
const DEPOSIT = "#2563EB";
const WITHDRAWAL = "#EA580C";

const CHART_TOTAL_HEIGHT_PX = 320;
const CHART_PLOT_HEIGHT_PX = CHART_TOTAL_HEIGHT_PX - FUNDAMENTALS_CHART_AXIS_ROW_PX;
const CHART_PLOT_BACKDROP_INSET_CLASS = "top-[8%] bottom-[4%]";
const Y_AXIS_TICK_COUNT = 6;

const CHART_SEGMENT_TRACK_CLASS =
  "flex w-auto min-w-0 flex-nowrap gap-0.5 rounded-[10px] bg-[#F4F4F5] p-0.5";
const CHART_SEGMENT_BTN_CLASS =
  "flex-none rounded-[10px] px-3 py-1.5 text-center font-sans text-[13px] leading-5 tracking-normal";
const CHART_SEGMENT_ACTIVE_CLASS =
  "bg-white font-medium text-[#09090B] shadow-[0px_1px_4px_0px_rgba(10,10,10,0.12),0px_1px_2px_0px_rgba(10,10,10,0.07)]";
const CHART_SEGMENT_INACTIVE_CLASS = "font-normal text-[#71717A]";

type CashChartRange = "all" | "ytd" | "1y" | "3y";
type Granularity = "month" | "year";

type Bucket = { key: string; label: string; inAmount: number; outAmount: number };

function niceCeiling(n: number): number {
  if (n <= 0) return 1;
  const exp = Math.floor(Math.log10(n));
  const frac = n / 10 ** exp;
  const niceFrac = frac <= 1 ? 1 : frac <= 2 ? 2 : frac <= 5 ? 5 : 10;
  return niceFrac * 10 ** exp;
}

function formatAxisUsd(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M`;
  if (n >= 1000) return `$${Math.round(n / 1000)}K`;
  return `$${Math.round(n)}`;
}

const TOOLTIP_USD = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/**
 * Chart “Deposits” = cash inflows; “Withdrawals” = **Cash Out** only.
 * Other expense / fees are ledger cash moves but must not inflate withdrawal bars.
 */
function splitCashAmounts(t: PortfolioTransaction): { inAmt: number; outAmt: number } {
  const op = t.operation.toLowerCase();
  if (op.includes("other expense")) {
    return { inAmt: 0, outAmt: 0 };
  }
  if (t.sum > 0) {
    return { inAmt: t.sum, outAmt: 0 };
  }
  if (t.sum < 0 && op.includes("cash out")) {
    return { inAmt: 0, outAmt: Math.abs(t.sum) };
  }
  return { inAmt: 0, outAmt: 0 };
}

function bucketKeyForRow(dateStr: string, g: Granularity): string {
  const d = parseISO(dateStr);
  return g === "month" ? format(d, "yyyy-MM") : format(d, "yyyy");
}

function buildBuckets(
  rows: PortfolioTransaction[],
  range: CashChartRange,
  granularity: Granularity,
): Bucket[] {
  const now = new Date();
  const contributions = new Map<string, { inAmount: number; outAmount: number }>();

  for (const t of rows) {
    const { inAmt, outAmt } = splitCashAmounts(t);
    if (inAmt === 0 && outAmt === 0) continue;
    const key = bucketKeyForRow(t.date, granularity);
    const cur = contributions.get(key) ?? { inAmount: 0, outAmount: 0 };
    cur.inAmount += inAmt;
    cur.outAmount += outAmt;
    contributions.set(key, cur);
  }

  let intervalStart: Date;
  let intervalEnd: Date = endOfMonth(now);

  const dates = rows.map((t) => parseISO(t.date));
  const dataMin = dates.length ? minDate(dates) : now;
  const dataMax = dates.length ? maxDate(dates) : now;

  if (range === "all") {
    if (rows.length === 0) return [];
    intervalStart =
      granularity === "month" ? startOfMonth(dataMin) : new Date(dataMin.getFullYear(), 0, 1);
    const endCap = maxDate([dataMax, now]);
    intervalEnd =
      granularity === "month" ? endOfMonth(endCap) : endOfMonth(new Date(endCap.getFullYear(), 11, 1));
  } else if (range === "ytd") {
    intervalStart = startOfYear(now);
  } else if (range === "1y") {
    intervalStart = startOfMonth(subMonths(now, 11));
  } else {
    intervalStart = startOfMonth(subYears(now, 3));
  }

  if (rows.length === 0 && range !== "all") {
    intervalEnd = endOfMonth(now);
  }

  const keysOrdered: { key: string; label: string }[] = [];

  if (isAfter(intervalStart, intervalEnd)) {
    return [];
  }

  if (granularity === "month") {
    const months = eachMonthOfInterval({ start: intervalStart, end: intervalEnd });
    for (const m of months) {
      const key = format(m, "yyyy-MM");
      keysOrdered.push({
        key,
        label: format(m, "MMM ''yy"),
      });
    }
  } else {
    const years = eachYearOfInterval({
      start: new Date(intervalStart.getFullYear(), 0, 1),
      end: new Date(intervalEnd.getFullYear(), 11, 1),
    });
    for (const y of years) {
      const key = format(y, "yyyy");
      keysOrdered.push({ key, label: key });
    }
  }

  return keysOrdered.map(({ key, label }) => {
    const v = contributions.get(key) ?? { inAmount: 0, outAmount: 0 };
    return { key, label, inAmount: v.inAmount, outAmount: v.outAmount };
  });
}

const RANGE_OPTIONS: { value: CashChartRange; label: string }[] = [
  { value: "all", label: "All Time" },
  { value: "ytd", label: "Year to date" },
  { value: "1y", label: "Last 12 months" },
  { value: "3y", label: "Last 3 years" },
];

const RANGE_TOGGLE_OPTIONS: { value: CashChartRange; label: string }[] = [
  { value: "all", label: "ALL" },
  { value: "ytd", label: "YTD" },
  { value: "1y", label: "1Y" },
  { value: "3y", label: "3Y" },
];

const GRANULARITY_OPTIONS: { value: Granularity; label: string }[] = [
  { value: "month", label: "Monthly" },
  { value: "year", label: "Annually" },
];

/** Minimum horizontal space (CSS px) for one x-axis label before we skip ticks. */
const X_LABEL_MIN_PX_MONTH = 42;
const X_LABEL_MIN_PX_YEAR = 34;

/**
 * How many buckets between visible x labels (1 = every bucket). Prefers 2, 3, 6, 12 months
 * so tick marks stay intuitive on narrow screens.
 */
function computeXLabelStep(
  granularity: Granularity,
  n: number,
  containerWidthPx: number,
): number {
  if (n <= 1) return 1;
  const wPx = containerWidthPx > 8 ? containerWidthPx : 800;
  const plotWidthPx = wPx - FUNDAMENTALS_CHART_Y_AXIS_W_PX - 16;
  const slotPx = plotWidthPx / n;
  const minLabel = granularity === "month" ? X_LABEL_MIN_PX_MONTH : X_LABEL_MIN_PX_YEAR;
  if (slotPx >= minLabel) return 1;
  const raw = Math.ceil(minLabel / slotPx);
  const nice = [2, 3, 4, 6, 12] as const;
  for (const s of nice) {
    if (s >= raw) return Math.min(s, n);
  }
  return Math.min(12, n);
}

function shouldDrawXLabel(i: number, n: number, step: number): boolean {
  if (step <= 1) return true;
  if (i % step === 0) return true;
  if (i === n - 1 && (n - 1) % step !== 0) return true;
  return false;
}

function tickTopPercent(tick: number, yMax: number): number {
  const insetTop = FUNDAMENTALS_CHART_PLOT_INSET_TOP_FRAC * 100;
  const insetBottom = FUNDAMENTALS_CHART_PLOT_INSET_BOTTOM_FRAC * 100;
  const band = 100 - insetTop - insetBottom;
  if (yMax <= 0) return insetTop + band;
  return insetTop + ((yMax - tick) / yMax) * band;
}

function formatBarLabelUsd(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M`;
  if (n >= 1000) return `$${Math.round(n / 1000)}K`;
  return `$${Math.round(n)}`;
}

function ChartSegmentToggle<T extends string>({
  "aria-label": ariaLabel,
  options,
  value,
  onChange,
  className,
}: {
  "aria-label": string;
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (next: T) => void;
  className?: string;
}) {
  return (
    <div className={cn(CHART_SEGMENT_TRACK_CLASS, className)} role="group" aria-label={ariaLabel}>
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={cn(
            CHART_SEGMENT_BTN_CLASS,
            value === opt.value ? CHART_SEGMENT_ACTIVE_CLASS : CHART_SEGMENT_INACTIVE_CLASS,
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function CashInOutBarChartSvg({ buckets, granularity }: { buckets: Bucket[]; granularity: Granularity }) {
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

  const { yMax, ticks, barW, gap, groupW, n } = useMemo(() => {
    const maxVal = buckets.reduce((m, b) => Math.max(m, b.inAmount, b.outAmount), 0);
    const yMax = niceCeiling(maxVal * 1.05) || 1;
    const ticks = Array.from(
      { length: Y_AXIS_TICK_COUNT },
      (_, i) => (yMax * (Y_AXIS_TICK_COUNT - 1 - i)) / (Y_AXIS_TICK_COUNT - 1),
    );
    const n = Math.max(buckets.length, 1);
    const groupW = innerW / n;
    const barW = Math.min(28, groupW * 0.32);
    const gap = groupW * 0.08;
    return { yMax, ticks, barW, gap, groupW, n };
  }, [buckets, innerW]);

  const yFor = useCallback(
    (v: number) => padT + ((yMax - v) / yMax) * innerH,
    [yMax, innerH, padT],
  );

  const baseY = yFor(0);

  const xLabelStep = useMemo(
    () => computeXLabelStep(granularity, n, plotWidth + FUNDAMENTALS_CHART_Y_AXIS_W_PX),
    [granularity, n, plotWidth],
  );

  const barValueLabels = useMemo(() => {
    const labels: { key: string; leftPx: number; topPx: number; text: string }[] = [];
    for (let i = 0; i < buckets.length; i++) {
      const b = buckets[i]!;
      const gx = padL + i * groupW + groupW / 2;
      const pairW = barW * 2 + gap;
      const startX = gx - pairW / 2;
      if (b.inAmount > 0) {
        labels.push({
          key: `in-${i}`,
          leftPx: startX + barW / 2,
          topPx: yFor(b.inAmount) - 4,
          text: formatBarLabelUsd(b.inAmount),
        });
      }
      if (b.outAmount > 0) {
        labels.push({
          key: `out-${i}`,
          leftPx: startX + barW + gap + barW / 2,
          topPx: yFor(b.outAmount) - 4,
          text: formatBarLabelUsd(b.outAmount),
        });
      }
    }
    return labels;
  }, [buckets, padL, groupW, barW, gap, yFor]);

  const updateHoverFromEvent = useCallback((i: number, clientX: number, clientY: number) => {
    const el = wrapRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setHover({ i, x: clientX - r.left, y: clientY - r.top });
  }, []);

  const hoveredBucket = hover != null ? buckets[hover.i] : null;
  const rotateXLabels = buckets.length > 16;

  return (
    <div ref={wrapRef} className="relative w-full min-w-0" onPointerLeave={() => setHover(null)}>
      <div
        style={{ height: CHART_TOTAL_HEIGHT_PX }}
        role="img"
        aria-label="Cash in and cash out amounts by period"
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
              <title>Cash in and cash out by period</title>
              <line
                x1={padL}
                x2={padL + innerW}
                y1={baseY}
                y2={baseY}
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

              {buckets.map((b, i) => {
                const gx = padL + i * groupW + groupW / 2;
                const pairW = barW * 2 + gap;
                const startX = gx - pairW / 2;
                const inH = yMax > 0 ? ((b.inAmount / yMax) * innerH) : 0;
                const outH = yMax > 0 ? ((b.outAmount / yMax) * innerH) : 0;
                return (
                  <g key={b.key}>
                    {inH > 0 ? (
                      <rect
                        x={startX}
                        y={baseY - inH}
                        width={barW}
                        height={Math.max(inH, 1)}
                        rx={2}
                        ry={2}
                        fill={DEPOSIT}
                      />
                    ) : null}
                    {outH > 0 ? (
                      <rect
                        x={startX + barW + gap}
                        y={baseY - outH}
                        width={barW}
                        height={Math.max(outH, 1)}
                        rx={2}
                        ry={2}
                        fill={WITHDRAWAL}
                      />
                    ) : null}
                  </g>
                );
              })}

              {buckets.map((b, i) => (
                <rect
                  key={`hit-${b.key}`}
                  x={padL + i * groupW}
                  y={0}
                  width={groupW}
                  height={plotH}
                  fill="transparent"
                  className="cursor-crosshair"
                  onPointerEnter={(e) => updateHoverFromEvent(i, e.clientX, e.clientY)}
                  onPointerMove={(e) => updateHoverFromEvent(i, e.clientX, e.clientY)}
                />
              ))}
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

            {hoveredBucket != null && hover != null ? (
              <div
                role="tooltip"
                className={cn(FUNDAMENTALS_CHART_TOOLTIP_CLASS, "z-20")}
                style={{
                  left: hover.x,
                  top: hover.y,
                  transform: "translate(-50%, calc(-100% - 10px))",
                }}
              >
                <p className="text-[12px] font-semibold leading-4 text-[#09090B]">{hoveredBucket.label}</p>
                <div className="mt-1.5 space-y-0.5">
                  <p className="text-[12px] leading-4 text-[#71717A]">
                    <span className="font-semibold" style={{ color: DEPOSIT }}>
                      Deposits
                    </span>
                    <span className="tabular-nums text-[#09090B]">
                      {" "}
                      {TOOLTIP_USD.format(hoveredBucket.inAmount)}
                    </span>
                  </p>
                  <p className="text-[12px] leading-4 text-[#71717A]">
                    <span className="font-semibold" style={{ color: WITHDRAWAL }}>
                      Withdrawals
                    </span>
                    <span className="tabular-nums text-[#09090B]">
                      {" "}
                      {TOOLTIP_USD.format(hoveredBucket.outAmount)}
                    </span>
                  </p>
                </div>
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
                  style={{ top: `${tickTopPercent(t, yMax)}%` }}
                >
                  {formatAxisUsd(t)}
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
            {buckets.map((b, i) => {
              if (!shouldDrawXLabel(i, n, xLabelStep)) return null;
              const leftPct = ((i + 0.5) / n) * 100;
              return (
                <div
                  key={`axis-${b.key}`}
                  className="absolute bottom-0 flex min-h-0 -translate-x-1/2 items-end justify-center overflow-visible px-0.5 pb-0.5"
                  style={{ left: `${leftPct}%` }}
                  title={b.label}
                >
                  <span
                    className="inline-block whitespace-nowrap font-['Inter'] text-[11px] font-normal tabular-nums leading-none text-[#71717A] sm:text-[12px]"
                    style={
                      rotateXLabels
                        ? {
                            transform: `rotate(${FUNDAMENTALS_CHART_AXIS_LABEL_ROTATE_DEG}deg)`,
                            transformOrigin: "center bottom",
                          }
                        : undefined
                    }
                  >
                    {b.label}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="shrink-0" style={{ width: FUNDAMENTALS_CHART_Y_AXIS_W_PX }} aria-hidden />
        </div>
      </div>
    </div>
  );
}

function CashInOutBarChartSectionInner({ rows }: { rows: PortfolioTransaction[] }) {
  const [range, setRange] = useState<CashChartRange>("all");
  const [rangeOpen, setRangeOpen] = useState(false);
  const rangeWrapRef = useRef<HTMLDivElement>(null);
  const [granularity, setGranularity] = useState<Granularity>("year");

  useEffect(() => {
    if (!rangeOpen) return;
    function onDocMouseDown(e: Event) {
      const el = rangeWrapRef.current;
      const t = e.target;
      if (!el || !(t instanceof Node) || el.contains(t)) return;
      setRangeOpen(false);
    }
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, [rangeOpen]);

  const rangeLabel = useMemo(
    () => RANGE_OPTIONS.find((o) => o.value === range)?.label ?? "All Time",
    [range],
  );

  const buckets = useMemo(() => buildBuckets(rows, range, granularity), [rows, range, granularity]);

  const hasAnyActivity = useMemo(
    () => buckets.some((b) => b.inAmount > 0 || b.outAmount > 0),
    [buckets],
  );

  return (
    <div className="mb-6">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="hidden text-2xl font-semibold leading-9 tracking-tight text-[#09090B] sm:block">Cash</h2>
        <div className="flex w-full min-w-0 flex-nowrap items-center gap-2 sm:w-auto sm:flex-wrap sm:justify-end sm:gap-3 md:flex-nowrap">
          {/* Web: compact range toggle (matches portfolio overview / charting). */}
          <ChartSegmentToggle
            aria-label="Cash chart time range"
            className="hidden sm:flex"
            options={RANGE_TOGGLE_OPTIONS}
            value={range}
            onChange={setRange}
          />

          {/* Mobile: full-label range dropdown. */}
          <div className="relative min-w-0 flex-1 sm:hidden sm:min-w-[180px]" ref={rangeWrapRef}>
            <button
              type="button"
              aria-expanded={rangeOpen}
              aria-haspopup="listbox"
              aria-label="Cash chart time range"
              onClick={() => setRangeOpen((o) => !o)}
              className="flex h-9 w-full cursor-pointer items-center justify-between gap-2 rounded-[10px] bg-[#F4F4F5] px-4 text-left text-sm font-normal leading-5 text-[#09090B] transition-colors hover:bg-[#EBEBEB] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#09090B]/10"
            >
              <span className="min-w-0 truncate">{rangeLabel}</span>
              <ChevronDown className="h-5 w-5 shrink-0 text-[#09090B]" aria-hidden />
            </button>
            {rangeOpen ? (
              <MobileBottomSheet
                open={rangeOpen}
                onClose={() => setRangeOpen(false)}
                title="Cash chart time range"
              >
                <div className={dropdownMenuMobileSheetBodyClassName} role="listbox">
                  {RANGE_OPTIONS.map((o) => {
                    const selected = o.value === range;
                    return (
                      <button
                        key={o.value}
                        type="button"
                        role="option"
                        aria-selected={selected}
                        onClick={() => {
                          setRange(o.value);
                          setRangeOpen(false);
                        }}
                        className={cn(dropdownMenuPlainItemRowClassName({ selected }), "font-medium")}
                      >
                        <span className="min-w-0 flex-1 text-left">{o.label}</span>
                        <span className="flex h-4 w-4 shrink-0 items-center justify-center" aria-hidden>
                          <Check
                            className={cn("h-4 w-4 text-[#09090B]", !selected && "invisible")}
                            strokeWidth={2}
                          />
                        </span>
                      </button>
                    );
                  })}
                </div>
              </MobileBottomSheet>
            ) : null}
          </div>

          <ChartSegmentToggle
            aria-label="Cash chart grouping"
            className="min-w-0 flex-1 sm:flex-none"
            options={GRANULARITY_OPTIONS}
            value={granularity}
            onChange={setGranularity}
          />
        </div>
      </div>

      {rows.length === 0 ? (
        <Empty variant="card" className="min-h-[200px]">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <BarChart3 className="h-6 w-6" strokeWidth={1.75} aria-hidden />
            </EmptyMedia>
            <EmptyTitle>No cash activity yet</EmptyTitle>
            <EmptyDescription className="max-w-sm">
              Add cash in or cash out to see deposits and withdrawals over time.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : buckets.length === 0 ? (
        <div className="flex min-h-[200px] items-center justify-center rounded-[12px] border border-[#E4E4E7] bg-white px-4 py-12 text-center text-sm text-[#71717A]">
          No periods in this range yet.
        </div>
      ) : (
        <div className="flex w-full min-w-0 flex-col gap-3">
          <div className={cn("w-full min-w-0", !hasAnyActivity && "opacity-60")}>
            <CashInOutBarChartSvg buckets={buckets} granularity={granularity} />
          </div>
          {!hasAnyActivity ? (
            <p className="text-center text-xs leading-4 text-[#71717A]">No cash movements in this range.</p>
          ) : null}
          <div className="flex flex-wrap items-center justify-center gap-6 text-xs font-medium text-[#71717A]">
            <span className="inline-flex items-center gap-2">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: DEPOSIT }} aria-hidden />
              Deposits
            </span>
            <span className="inline-flex items-center gap-2">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: WITHDRAWAL }} aria-hidden />
              Withdrawals
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

export const CashInOutBarChartSection = memo(CashInOutBarChartSectionInner);
