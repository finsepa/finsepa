"use client";

import { useEffect, useMemo, useState } from "react";
import type { IndexCardData } from "@/lib/screener/indices-today";
import { FadeIn } from "@/components/markets/skeleton";
import { IndexCardSkeleton } from "@/components/markets/markets-skeletons";

type IndexEntry = {
  name: string;
  value: string;
  change: string;
  trend: number[];
};

const labels = ["S&P 500", "Nasdaq 100", "Dow Jones", "Russell 2000", "VIX"] as const;

function formatIndexValue(price: number): string {
  return price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatChangePercent(changePercent1D: number): string {
  const sign = changePercent1D >= 0 ? "+" : "";
  return `${sign}${changePercent1D.toFixed(2)}%`;
}

function MiniSparkline({ points, positive }: { points: number[]; positive: boolean }) {
  const w = 100;
  const h = 40;
  const safe =
    points.length >= 2 ? points : points.length === 1 ? [points[0]!, points[0]!] : [0, 0];

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
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="h-10 w-full">
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

export function IndexCards() {
  const [cards, setCards] = useState<IndexCardData[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [fadeIn, setFadeIn] = useState(false);

  useEffect(() => {
    let mounted = true;
    const url = `/api/screener/indices?debug=${Date.now()}`;

    async function load() {
      try {
        const res = await fetch(url, { cache: "no-store" });
        const json = (await res.json()) as { cards?: IndexCardData[]; fetchedAt?: string };
        if (!mounted) return;
        setCards(Array.isArray(json.cards) ? json.cards : []);
        setLoaded(true);
        requestAnimationFrame(() => setFadeIn(true));
      } catch (err) {
        if (!mounted) return;
        setLoaded(false);
      }
    }

    void load();
    return () => {
      mounted = false;
    };
  }, []);

  const entries: IndexEntry[] = useMemo(() => {
    const byName = new Map(cards.map((c) => [c.name, c] as const));
    const mapped = labels.map((name) => {
      const c = byName.get(name);
      if (!c) {
        return null;
      }
      return {
        name,
        value: formatIndexValue(c.price),
        change: formatChangePercent(c.changePercent1D),
        trend: c.sparklineToday,
      };
    });
    return mapped.filter(Boolean) as IndexEntry[];
  }, [cards]);

  if (!loaded || entries.length !== labels.length) {
    return (
      <div className="mb-6 grid grid-cols-5 gap-6">
        {labels.map((name) => (
          <IndexCardSkeleton key={name} name={name} />
        ))}
      </div>
    );
  }

  return (
    <div className="mb-6 grid grid-cols-5 gap-6">
      {entries.map(({ name, value, change, trend }) => {
        const positive = !change.startsWith("-");
        return (
          <div
            key={name}
            className="flex flex-col justify-between overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-[0px_1px_2px_0px_rgba(10,10,10,0.06)] transition hover:shadow-md"
          >
            <div className="px-4 pt-4">
              <div className="mb-2 flex items-start justify-between gap-2">
                <span className="text-[12px] font-medium text-neutral-500">{name}</span>
                <FadeIn show={fadeIn}>
                  <span
                    className={`rounded-md px-1.5 py-0.5 text-[11px] font-semibold tabular-nums ${
                      positive ? "bg-[#F0FDF4] text-[#16A34A]" : "bg-[#FEF2F2] text-[#DC2626]"
                    }`}
                  >
                    {change}
                  </span>
                </FadeIn>
              </div>
              <FadeIn show={fadeIn}>
                <div className="text-[22px] font-bold tracking-tight text-neutral-900">{value}</div>
              </FadeIn>
            </div>
            <div className="px-4 pb-4">
              <FadeIn show={fadeIn}>
                <MiniSparkline points={trend} positive={positive} />
              </FadeIn>
            </div>
          </div>
        );
      })}
    </div>
  );
}
