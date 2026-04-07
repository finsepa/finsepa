"use client";

import { memo, useMemo, useState } from "react";
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

const DEPOSIT = "#2563EB";
const WITHDRAWAL = "#F97316";

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

const VB_W = 640;
const VB_H = 240;
const PAD_L = 48;
const PAD_R = 8;
const PAD_T = 12;
const PAD_B = 44;

function CashInOutBarChartSvg({ buckets }: { buckets: Bucket[] }) {
  const { yMax, ticks, bars } = useMemo(() => {
    const maxVal = buckets.reduce((m, b) => Math.max(m, b.inAmount, b.outAmount), 0);
    const yMax = niceCeiling(maxVal * 1.05) || 1;
    const tickCount = 5;
    const ticks: number[] = [];
    for (let i = 0; i <= tickCount; i++) ticks.push((yMax * i) / tickCount);

    const plotW = VB_W - PAD_L - PAD_R;
    const plotH = VB_H - PAD_T - PAD_B;
    const n = Math.max(buckets.length, 1);
    const slotW = plotW / n;
    const pairW = slotW * 0.55;
    const barW = (pairW - 4) / 2;
    const gapBetweenPair = 4;

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

    return { yMax, ticks, bars };
  }, [buckets]);

  const plotW = VB_W - PAD_L - PAD_R;
  const plotH = VB_H - PAD_T - PAD_B;
  const baseY = PAD_T + plotH;

  return (
    <div
      className="relative w-full min-w-0"
      style={{ aspectRatio: `${VB_W} / ${VB_H}` }}
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
              x={PAD_L - 8}
              y={y + 4}
              textAnchor="end"
              className="fill-[#71717A] text-[11px] font-normal"
              style={{ fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif" }}
            >
              {formatAxisUsd(tv)}
            </text>
          </g>
        );
      })}

      {bars.map((b, i) => (
        <g key={buckets[i]?.key ?? i}>
          {b.inRect.height > 0 ? (
            <rect x={b.inRect.x} y={b.inRect.y} width={b.inRect.width} height={b.inRect.height} fill={DEPOSIT} />
          ) : null}
          {b.outRect.height > 0 ? (
            <rect
              x={b.outRect.x}
              y={b.outRect.y}
              width={b.outRect.width}
              height={b.outRect.height}
              fill={WITHDRAWAL}
            />
          ) : null}
          <text
            x={PAD_L + (i + 0.5) * (plotW / Math.max(buckets.length, 1))}
            y={VB_H - 12}
            textAnchor="middle"
            className="fill-[#71717A] text-[11px] font-medium"
            style={{ fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif" }}
          >
            {buckets[i]?.label ?? ""}
          </text>
        </g>
      ))}
      </svg>
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
    <div className="mb-8">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-lg font-semibold leading-7 text-[#09090B]">Cash</h2>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <select
              value={range}
              onChange={(e) => setRange(e.target.value as CashChartRange)}
              className="h-9 cursor-pointer appearance-none rounded-[10px] border-0 bg-[#F4F4F5] py-2 pl-3 pr-9 text-[14px] font-medium leading-5 text-[#09090B] outline-none focus:ring-2 focus:ring-[#09090B]/10"
              aria-label="Cash chart time range"
            >
              {RANGE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <ChevronDown
              className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#71717A]"
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
                "rounded-[8px] px-3 py-1.5 text-[13px] font-medium leading-5 transition-all",
                granularity === "month"
                  ? "bg-white text-[#09090B] shadow-[0px_1px_2px_0px_rgba(10,10,10,0.06)]"
                  : "text-[#71717A] hover:text-[#09090B]",
              )}
            >
              Monthly
            </button>
            <button
              type="button"
              onClick={() => setGranularity("year")}
              className={cn(
                "rounded-[8px] px-3 py-1.5 text-[13px] font-medium leading-5 transition-all",
                granularity === "year"
                  ? "bg-white text-[#09090B] shadow-[0px_1px_2px_0px_rgba(10,10,10,0.06)]"
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
        <div className="w-full min-w-0 pt-2 sm:pt-4">
          <div className={cn("w-full min-w-0", !hasAnyActivity && "opacity-60")}>
            <CashInOutBarChartSvg buckets={buckets} />
          </div>
          {!hasAnyActivity ? (
            <p className="pb-3 text-center text-xs text-[#71717A]">No cash movements in this range.</p>
          ) : null}
          <div className="flex flex-wrap items-center justify-center gap-6 border-t border-[#F4F4F5] py-3">
            <span className="inline-flex items-center gap-2 text-[13px] font-medium text-[#09090B]">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: DEPOSIT }} />
              Cash in
            </span>
            <span className="inline-flex items-center gap-2 text-[13px] font-medium text-[#09090B]">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: WITHDRAWAL }} />
              Cash out
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

export const CashInOutBarChartSection = memo(CashInOutBarChartSectionInner);
