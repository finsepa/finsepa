"use client";

import { type MouseEvent, memo, useCallback, useMemo, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
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

import { cn } from "@/lib/utils";
import type { PortfolioTransaction } from "@/components/portfolio/portfolio-types";

/** Figma Color/Blue/600 + Color/Orange/600 */
const DEPOSIT = "#2563EB";
const WITHDRAWAL = "#EA580C";

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

function splitCashAmounts(t: PortfolioTransaction): { inAmt: number; outAmt: number } {
  if (t.sum > 0) return { inAmt: t.sum, outAmt: 0 };
  if (t.sum < 0) return { inAmt: 0, outAmt: Math.abs(t.sum) };
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

/** Match Figma cash chart frame (~1079×280 plot + left axis). */
const VB_W = 1080;
const VB_H = 280;
const PAD_L = 48;
const PAD_R = 20;
const PAD_T = 20;
const PAD_B = 36;
/** Deposit + withdrawal pair: 32px bars, 12px gap (scaled into each slot). */
const FIGMA_BAR_W = 32;
const FIGMA_PAIR_GAP = 12;

type CashBarTooltip = {
  x: number;
  y: number;
  periodLabel: string;
  depositsLabel: string;
  withdrawalsLabel: string;
};

function CashInOutBarChartSvg({ buckets }: { buckets: Bucket[] }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [tooltip, setTooltip] = useState<CashBarTooltip | null>(null);

  const { yMax, ticks, bars, plotW, plotH, slotW, n } = useMemo(() => {
    const maxVal = buckets.reduce((m, b) => Math.max(m, b.inAmount, b.outAmount), 0);
    const yMax = niceCeiling(maxVal * 1.05) || 1;
    const tickCount = 5;
    const ticks: number[] = [];
    for (let i = 0; i <= tickCount; i++) ticks.push((yMax * i) / tickCount);

    const plotW = VB_W - PAD_L - PAD_R;
    const plotH = VB_H - PAD_T - PAD_B;
    const n = Math.max(buckets.length, 1);
    const slotW = plotW / n;
    const scale = Math.min(1, (slotW * 0.72) / (FIGMA_BAR_W * 2 + FIGMA_PAIR_GAP));
    const barW = FIGMA_BAR_W * scale;
    const gapBetweenPair = FIGMA_PAIR_GAP * scale;
    const pairW = barW * 2 + gapBetweenPair;

    const bars = buckets.map((b, i) => {
      const cx = PAD_L + i * slotW + slotW / 2;
      const leftX = cx - pairW / 2;
      const inH = yMax > 0 ? (b.inAmount / yMax) * plotH : 0;
      const outH = yMax > 0 ? (b.outAmount / yMax) * plotH : 0;
      const baseY = PAD_T + plotH;
      return {
        inRect: {
          x: leftX,
          y: baseY - inH,
          width: barW,
          height: Math.max(inH, 0),
        },
        outRect: {
          x: leftX + barW + gapBetweenPair,
          y: baseY - outH,
          width: barW,
          height: Math.max(outH, 0),
        },
      };
    });

    return { yMax, ticks, bars, plotW, plotH, slotW, n };
  }, [buckets]);

  const baseY = PAD_T + plotH;

  const handleMouseMove = useCallback(
    (e: MouseEvent<HTMLDivElement>) => {
      const wrap = wrapRef.current;
      if (!wrap || n === 0) return;

      const r = wrap.getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0) return;

      const vx = ((e.clientX - r.left) / r.width) * VB_W;
      const vy = ((e.clientY - r.top) / r.height) * VB_H;

      if (vx < PAD_L || vx > PAD_L + plotW || vy < PAD_T || vy > VB_H) {
        setTooltip(null);
        return;
      }

      const idx = Math.min(n - 1, Math.max(0, Math.floor((vx - PAD_L) / slotW)));
      const b = buckets[idx];
      if (!b) {
        setTooltip(null);
        return;
      }

      const px = e.clientX - r.left;
      const py = e.clientY - r.top;
      const tw = 220;
      const th = 92;
      const pad = 8;
      let x = px + pad;
      let y = py - th - pad;
      if (x + tw > r.width - pad) x = r.width - tw - pad;
      if (x < pad) x = pad;
      if (y < pad) y = pad;
      if (y + th > r.height - pad) y = Math.min(r.height - th - pad, py + pad);

      setTooltip({
        x,
        y,
        periodLabel: b.label,
        depositsLabel: TOOLTIP_USD.format(b.inAmount),
        withdrawalsLabel: TOOLTIP_USD.format(b.outAmount),
      });
    },
    [buckets, n, plotW, slotW],
  );

  const handleMouseLeave = useCallback(() => setTooltip(null), []);

  return (
    <div
      ref={wrapRef}
      className="relative w-full min-w-0"
      style={{ aspectRatio: `${VB_W} / ${VB_H}` }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      <svg
        className="absolute inset-0 h-full w-full"
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label="Cash in and cash out amounts by period"
      >
        <title>Cash in and cash out by period</title>
      {ticks.map((tv) => {
        const y = baseY - (yMax > 0 ? (tv / yMax) * plotH : 0);
        return (
          <g key={tv}>
            <line
              x1={PAD_L}
              y1={y}
              x2={PAD_L + plotW}
              y2={y}
              stroke="#E4E4E7"
              strokeWidth={1}
            />
            <text
              x={PAD_L - 10}
              y={y + 4}
              textAnchor="end"
              className="fill-[#71717A]"
              style={{
                fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
                fontSize: 12,
                fontWeight: 400,
                lineHeight: "16px",
              }}
            >
              {formatAxisUsd(tv)}
            </text>
          </g>
        );
      })}

      {bars.map((b, i) => (
        <g key={buckets[i]?.key ?? i}>
          {b.inRect.height > 0 ? (
            <rect
              x={b.inRect.x}
              y={b.inRect.y}
              width={b.inRect.width}
              height={b.inRect.height}
              rx={Math.min(3, b.inRect.width / 2)}
              fill={DEPOSIT}
            />
          ) : null}
          {b.outRect.height > 0 ? (
            <rect
              x={b.outRect.x}
              y={b.outRect.y}
              width={b.outRect.width}
              height={b.outRect.height}
              rx={Math.min(3, b.outRect.width / 2)}
              fill={WITHDRAWAL}
            />
          ) : null}
          <text
            x={PAD_L + (i + 0.5) * (plotW / Math.max(buckets.length, 1))}
            y={VB_H - 10}
            textAnchor="middle"
            className="fill-[#71717A]"
            style={{
              fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
              fontSize: 12,
              fontWeight: 400,
              lineHeight: "16px",
            }}
          >
            {buckets[i]?.label ?? ""}
          </text>
        </g>
      ))}
      </svg>
      {tooltip ? (
        <div
          className="pointer-events-none absolute z-10 min-w-[200px] rounded-lg border border-[#E4E4E7] bg-white px-3 py-2 shadow-[0px_1px_4px_0px_rgba(10,10,10,0.08),0px_1px_2px_0px_rgba(10,10,10,0.06)]"
          style={{ left: tooltip.x, top: tooltip.y }}
          role="tooltip"
        >
          <p className="text-[11px] leading-4 text-[#71717A]">{tooltip.periodLabel}</p>
          <div className="mt-1.5 space-y-1">
            <p className="text-xs font-semibold tabular-nums text-[#09090B]">
              <span className="font-medium text-[#71717A]">Total deposits</span>{" "}
              <span style={{ color: DEPOSIT }}>{tooltip.depositsLabel}</span>
            </p>
            <p className="text-xs font-semibold tabular-nums text-[#09090B]">
              <span className="font-medium text-[#71717A]">Total withdrawals</span>{" "}
              <span style={{ color: WITHDRAWAL }}>{tooltip.withdrawalsLabel}</span>
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function CashInOutBarChartSectionInner({ rows }: { rows: PortfolioTransaction[] }) {
  const [range, setRange] = useState<CashChartRange>("all");
  const [granularity, setGranularity] = useState<Granularity>("year");

  const buckets = useMemo(() => buildBuckets(rows, range, granularity), [rows, range, granularity]);

  const hasAnyActivity = useMemo(
    () => buckets.some((b) => b.inAmount > 0 || b.outAmount > 0),
    [buckets],
  );

  return (
    <div className="mb-6">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-2xl font-semibold leading-9 tracking-tight text-[#09090B]">Cash</h2>
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <select
              value={range}
              onChange={(e) => setRange(e.target.value as CashChartRange)}
              className="h-10 min-h-10 cursor-pointer appearance-none rounded-[10px] border border-[#E4E4E7] bg-white py-2 pl-4 pr-10 text-sm font-medium leading-5 text-[#09090B] shadow-[0px_1px_2px_0px_rgba(10,10,10,0.06)] outline-none focus-visible:ring-2 focus-visible:ring-[#09090B]/10"
              aria-label="Cash chart time range"
            >
              {RANGE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <ChevronDown
              className="pointer-events-none absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-[#71717A]"
              aria-hidden
            />
          </div>

          <div
            className="inline-flex rounded-[10px] bg-[#F4F4F5] p-0.5"
            role="group"
            aria-label="Cash chart grouping"
          >
            <button
              type="button"
              onClick={() => setGranularity("month")}
              className={cn(
                "rounded-[10px] px-4 py-1.5 text-sm font-medium leading-5 transition-all",
                granularity === "month"
                  ? "bg-white text-[#09090B] shadow-[0px_1px_4px_0px_rgba(10,10,10,0.12),0px_1px_2px_0px_rgba(10,10,10,0.07)]"
                  : "text-[#71717A] hover:text-[#09090B]",
              )}
            >
              Monthly
            </button>
            <button
              type="button"
              onClick={() => setGranularity("year")}
              className={cn(
                "rounded-[10px] px-4 py-1.5 text-sm font-medium leading-5 transition-all",
                granularity === "year"
                  ? "bg-white text-[#09090B] shadow-[0px_1px_4px_0px_rgba(10,10,10,0.12),0px_1px_2px_0px_rgba(10,10,10,0.07)]"
                  : "text-[#71717A] hover:text-[#09090B]",
              )}
            >
              Annually
            </button>
          </div>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="flex min-h-[200px] items-center justify-center rounded-[12px] border border-dashed border-[#E4E4E7] bg-[#FAFAFA] px-4 py-12 text-center text-sm text-[#71717A]">
          Add cash in or cash out to see deposits and withdrawals over time.
        </div>
      ) : buckets.length === 0 ? (
        <div className="flex min-h-[200px] items-center justify-center rounded-[12px] border border-[#E4E4E7] bg-white px-4 py-12 text-center text-sm text-[#71717A]">
          No periods in this range yet.
        </div>
      ) : (
        <div className="flex w-full min-w-0 flex-col gap-3 px-5">
          <div className={cn("w-full min-w-0", !hasAnyActivity && "opacity-60")}>
            <CashInOutBarChartSvg buckets={buckets} />
          </div>
          {!hasAnyActivity ? (
            <p className="text-center text-xs leading-4 text-[#71717A]">No cash movements in this range.</p>
          ) : null}
          <div className="flex flex-wrap items-center justify-center gap-4 py-1">
            <span className="inline-flex items-center gap-2 text-sm font-normal leading-5 text-[#09090B]">
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: DEPOSIT }} aria-hidden />
              Deposits
            </span>
            <span className="inline-flex items-center gap-2 text-sm font-normal leading-5 text-[#09090B]">
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: WITHDRAWAL }} aria-hidden />
              Withdrawals
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

export const CashInOutBarChartSection = memo(CashInOutBarChartSectionInner);
