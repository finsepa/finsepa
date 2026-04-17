"use client";

import { useMemo } from "react";
import type { IndexCardData } from "@/lib/screener/indices-today";
import { FadeIn } from "@/components/markets/skeleton";

type IndexEntry = {
  name: string;
  value: string;
  change: string;
  trend: number[] | null;
};

const labels = ["S&P 500", "Nasdaq 100", "Dow Jones", "Russell 2000", "VIX"] as const;

function formatIndexValue(price: number | null): string {
  if (price == null || !Number.isFinite(price)) return "—";
  return price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatChangePercent(changePercent1D: number | null): string {
  if (changePercent1D == null || !Number.isFinite(changePercent1D)) return "—";
  const sign = changePercent1D >= 0 ? "+" : "";
  return `${sign}${changePercent1D.toFixed(2)}%`;
}

function MiniSparkline({ points, positive }: { points: number[]; positive: boolean }) {
  const w = 100;
  const h = 32;
  if (points.length < 2) {
    return (
      <div className="flex h-8 items-center text-[12px] font-medium tabular-nums text-neutral-400">—</div>
    );
  }
  const safe = points;

  const min = Math.min(...safe);
  const max = Math.max(...safe);
  const range = max - min || 1;

  const pts = safe.map((p, i) => {
    const x = (i / (safe.length - 1)) * w;
    const y = h - ((p - min) / range) * (h - 6) - 3;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  const polyline = pts.join(" ");
  const fill = `M${pts[0]} L${pts.slice(1).join(" L")} L${w},${h} L0,${h} Z`;
  const stroke = positive ? "#16A34A" : "#DC2626";
  const fillColor = positive ? "rgba(22,163,74,0.1)" : "rgba(220,38,38,0.1)";

  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="h-8 w-full">
      <path d={fill} fill={fillColor} />
      <polyline
        points={polyline}
        fill="none"
        stroke={stroke}
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function IndexCards({ initialCards }: { initialCards?: IndexCardData[] }) {
  const cards = Array.isArray(initialCards) ? initialCards : [];
  const fadeIn = true;

  const entries: IndexEntry[] = useMemo(() => {
    const byName = new Map(cards.map((c) => [c.name, c] as const));
    const mapped = labels.map((name) => {
      const c = byName.get(name);
      if (!c) return { name, value: "—", change: "—", trend: null };
      return {
        name,
        value: formatIndexValue(c.price),
        change: formatChangePercent(c.changePercent1D),
        trend: c.sparklineToday && c.sparklineToday.length >= 2 ? c.sparklineToday : null,
      };
    });
    return mapped;
  }, [cards]);

  if (entries.length !== labels.length) return null;

  return (
    <div className="mb-5 flex gap-3 overflow-x-auto overflow-y-visible pb-1 pt-0.5 [-webkit-overflow-scrolling:touch] snap-x snap-mandatory sm:mb-6 lg:grid lg:grid-cols-5 lg:gap-6 lg:overflow-visible lg:pb-0 lg:pt-0">
      {entries.map(({ name, value, change, trend }) => {
        const neutral = change === "—" || value === "—" || change === "-" || value === "-";
        const positive = !neutral && !change.startsWith("-");
        const sparkPositive =
          trend && trend.length >= 2 ? trend[trend.length - 1]! >= trend[0]! : positive;
        return (
          <div
            key={name}
            className="flex h-fit min-w-[148px] shrink-0 snap-start flex-col gap-2 overflow-hidden rounded-xl border border-[#E4E4E7] bg-white px-3 py-3 shadow-[0px_1px_2px_0px_rgba(10,10,10,0.06)] transition hover:shadow-[0px_2px_4px_0px_rgba(10,10,10,0.08)] sm:min-w-[160px] sm:px-4 sm:py-4 lg:min-w-0"
          >
            <p className="text-[13px] font-normal leading-5 text-[#09090B] sm:text-[14px]">{name}</p>
            <div className="flex min-w-0 items-center gap-2">
              <FadeIn show={fadeIn}>
                <p className="min-w-0 flex-1 text-[16px] font-bold leading-6 tabular-nums text-[#09090B]">{value}</p>
              </FadeIn>
              <FadeIn show={fadeIn}>
                <span
                  className={`shrink-0 rounded-lg px-1 py-0.5 text-[12px] font-normal leading-4 tabular-nums ${
                    neutral
                      ? "bg-neutral-100 text-neutral-500"
                      : positive
                        ? "bg-[#F0FDF4] text-[#16A34A]"
                        : "bg-[#FEF2F2] text-[#DC2626]"
                  }`}
                >
                  {change}
                </span>
              </FadeIn>
            </div>
            <FadeIn show={fadeIn}>
              {trend && trend.length >= 2 ? (
                <MiniSparkline points={trend} positive={sparkPositive} />
              ) : (
                <div className="flex h-8 items-center text-[12px] font-medium tabular-nums text-neutral-400">—</div>
              )}
            </FadeIn>
          </div>
        );
      })}
    </div>
  );
}
