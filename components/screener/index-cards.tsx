"use client";

import { ArrowDown, ArrowUp } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { FadeIn } from "@/components/markets/skeleton";
import type { IndexCardData } from "@/lib/screener/indices-today";
import {
  SCREENER_INDEX_CARD_LABELS,
  withIndexCardLocalFallbacks,
} from "@/lib/screener/screener-index-card-fallbacks";

type IndexEntry = {
  name: string;
  value: string;
  change: string;
  positive: boolean;
  neutral: boolean;
};

function formatIndexValue(price: number | null): string {
  if (price == null || !Number.isFinite(price)) return "—";
  return price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatChangePercent(changePercent1D: number | null): string {
  if (changePercent1D == null || !Number.isFinite(changePercent1D)) return "—";
  const sign = changePercent1D >= 0 ? "+" : "";
  return `${sign}${changePercent1D.toFixed(2)}%`;
}

function entriesFromCards(cards: IndexCardData[]): IndexEntry[] {
  const merged = withIndexCardLocalFallbacks(cards);
  const byName = new Map(merged.map((c) => [c.name, c] as const));
  return SCREENER_INDEX_CARD_LABELS.map((name) => {
    const c = byName.get(name);
    const value = formatIndexValue(c?.price ?? null);
    const change = formatChangePercent(c?.changePercent1D ?? null);
    const neutral = change === "—" || value === "—";
    const positive = !neutral && !change.startsWith("-");
    return { name, value, change, positive, neutral };
  });
}

export function IndexCards({ initialCards }: { initialCards?: IndexCardData[] }) {
  const [cards, setCards] = useState<IndexCardData[]>(() =>
    Array.isArray(initialCards) ? initialCards : [],
  );

  useEffect(() => {
    if (Array.isArray(initialCards) && initialCards.length > 0) {
      setCards(initialCards);
    }
  }, [initialCards]);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/screener/indices", { credentials: "include" })
      .then((res) => (res.ok ? res.json() : null))
      .then((json: { cards?: IndexCardData[] } | null) => {
        if (cancelled || !json?.cards?.length) return;
        setCards(json.cards);
      })
      .catch(() => {
        /* keep SSR + local fallbacks */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const entries = useMemo(() => entriesFromCards(cards), [cards]);
  const fadeIn = true;

  if (entries.length !== SCREENER_INDEX_CARD_LABELS.length) return null;

  return (
    <div
      className="mb-5 -mx-4 overflow-x-auto overscroll-x-contain px-4 [-webkit-overflow-scrolling:touch] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:mb-6 md:mx-0 md:overflow-visible md:px-0"
      aria-label="Market indices"
    >
      <div className="flex w-max flex-nowrap gap-3 md:grid md:w-full md:max-w-full md:grid-cols-3 md:gap-4 lg:grid-cols-4 xl:grid-cols-5">
      {entries.map(({ name, value, change, positive, neutral }) => {
        const TrendIcon = neutral ? null : positive ? ArrowUp : ArrowDown;
        return (
          <div
            key={name}
            className="flex w-[10.75rem] shrink-0 flex-col items-start gap-1 overflow-hidden rounded-2xl border border-[#E4E4E7] bg-white px-3 py-3 shadow-[0px_1px_2px_0px_rgba(10,10,10,0.06)] transition hover:shadow-[0px_2px_6px_0px_rgba(10,10,10,0.08)] sm:px-4 sm:py-4 md:w-auto md:min-w-0 md:shrink"
          >
            <p className="w-full truncate text-left text-[13px] font-medium leading-5 text-[#09090B] sm:text-[14px]">
              {name}
            </p>
            <FadeIn show={fadeIn}>
              <p className="w-full truncate text-left text-[15px] font-bold leading-6 tabular-nums text-[#09090B] sm:text-base">
                {value}
              </p>
            </FadeIn>
            <FadeIn show={fadeIn}>
              <div
                className={`flex w-full items-center gap-1 text-left text-[13px] font-medium leading-5 tabular-nums sm:text-[14px] ${
                  neutral ? "text-[#71717A]" : positive ? "text-[#16A34A]" : "text-[#DC2626]"
                }`}
              >
                <span className="truncate">{change}</span>
                {TrendIcon ? <TrendIcon className="h-4 w-4 shrink-0" aria-hidden /> : null}
              </div>
            </FadeIn>
          </div>
        );
      })}
      </div>
    </div>
  );
}
