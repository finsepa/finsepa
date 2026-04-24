"use client";

import { useMemo } from "react";
import type { IndexCardData } from "@/lib/screener/indices-today";
import { FadeIn } from "@/components/markets/skeleton";

type IndexEntry = {
  name: string;
  value: string;
  change: string;
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

export function IndexCards({ initialCards }: { initialCards?: IndexCardData[] }) {
  const cards = Array.isArray(initialCards) ? initialCards : [];
  const fadeIn = true;

  const entries: IndexEntry[] = useMemo(() => {
    const byName = new Map(cards.map((c) => [c.name, c] as const));
    return labels.map((name) => {
      const c = byName.get(name);
      if (!c) return { name, value: "—", change: "—" };
      return {
        name,
        value: formatIndexValue(c.price),
        change: formatChangePercent(c.changePercent1D),
      };
    });
  }, [cards]);

  if (entries.length !== labels.length) return null;

  return (
    <div className="mb-5 flex gap-3 overflow-x-auto overflow-y-visible pb-1 pt-0.5 [-webkit-overflow-scrolling:touch] snap-x snap-mandatory sm:mb-6 lg:grid lg:grid-cols-5 lg:gap-6 lg:overflow-visible lg:pb-0 lg:pt-0">
      {entries.map(({ name, value, change }) => {
        const neutral = change === "—" || value === "—" || change === "-" || value === "-";
        const positive = !neutral && !change.startsWith("-");
        return (
          <div
            key={name}
            className="flex h-fit min-w-[148px] shrink-0 snap-start flex-col items-start gap-1 overflow-hidden rounded-2xl border border-[#E4E4E7] bg-white px-4 py-4 shadow-[0px_1px_2px_0px_rgba(10,10,10,0.06)] transition hover:shadow-[0px_2px_6px_0px_rgba(10,10,10,0.08)] sm:min-w-[160px] lg:min-w-0"
          >
            <p className="w-full text-left text-[14px] font-medium leading-5 text-[#09090B]">{name}</p>
            <FadeIn show={fadeIn}>
              <p className="w-full text-left font-['Inter'] text-base font-bold leading-6 tracking-normal tabular-nums text-[#09090B]">
                {value}
              </p>
            </FadeIn>
            <FadeIn show={fadeIn}>
              <p
                className={`w-full text-left text-[14px] font-medium leading-5 tabular-nums ${
                  neutral ? "text-[#71717A]" : positive ? "text-[#16A34A]" : "text-[#DC2626]"
                }`}
              >
                {change}
              </p>
            </FadeIn>
          </div>
        );
      })}
    </div>
  );
}
