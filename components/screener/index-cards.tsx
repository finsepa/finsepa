"use client";

import { ArrowDown, ArrowUp } from "@/lib/icons";
import { useEffect, useMemo, useState } from "react";

import { FadeIn } from "@/components/markets/skeleton";
import { MOBILE_CARD_SURFACE_CLASS } from "@/components/design-system/card-surface-styles";
import type { IndexCardData } from "@/lib/screener/indices-today";
import {
  fetchScreenerIndexCardsCached,
  readScreenerIndexCardsCache,
  resetScreenerIndexCardsCacheIfStale,
  writeScreenerIndexCardsCache,
} from "@/lib/screener/screener-index-cards-cache";
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
  const sign = price < 0 ? "-" : "";
  const abs = Math.abs(price);
  const [whole, frac] = abs.toFixed(2).split(".");
  const grouped = whole!.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${sign}${grouped}.${frac}`;
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

export const INDEX_CARDS_GRID_CLASS =
  "flex w-max flex-nowrap gap-3 md:grid md:w-full md:max-w-full md:grid-cols-3 md:gap-4 lg:grid-cols-4 xl:grid-cols-5";

/** Outer shell — keeps vertical overflow visible so card shadows are not clipped. */
export const INDEX_CARDS_SCROLL_OUTER_CLASS = "mb-4 overflow-visible sm:mb-5 md:mb-6";

/** Horizontal scroll track — `mobile-scroll-x` reserves bottom space for shadows on small screens. */
export const INDEX_CARDS_SCROLL_CLASS =
  "-mx-4 px-4 pt-1 mobile-scroll-x md:mx-0 md:overflow-visible md:px-0 md:pb-0 md:pt-0 md:mb-0";

export const INDEX_CARD_SURFACE_CLASS =
  `flex w-[7.25625rem] shrink-0 flex-col items-start gap-0.5 max-md:py-2.5 overflow-hidden rounded-2xl border border-[#E4E4E7] bg-white px-3 py-3 shadow-[0px_1px_2px_0px_rgba(10,10,10,0.06)] transition max-md:overflow-visible md:gap-1 md:hover:shadow-[0px_2px_6px_0px_rgba(10,10,10,0.08)] sm:px-4 sm:py-4 md:w-auto md:min-w-0 md:shrink ${MOBILE_CARD_SURFACE_CLASS}`;

function seedIndexCards(initialCards?: IndexCardData[]): IndexCardData[] {
  if (Array.isArray(initialCards) && initialCards.length > 0) return initialCards;
  return withIndexCardLocalFallbacks([]);
}

export function IndexCards({
  initialCards,
  marketCacheSegment = "",
}: {
  initialCards?: IndexCardData[];
  /** From SSR stocks payload — live 15m slot or frozen last regular session. */
  marketCacheSegment?: string;
}) {
  const [cards, setCards] = useState<IndexCardData[]>(() => seedIndexCards(initialCards));

  useEffect(() => {
    if (Array.isArray(initialCards) && initialCards.length > 0) {
      setCards(initialCards);
      if (marketCacheSegment) {
        resetScreenerIndexCardsCacheIfStale(marketCacheSegment);
        writeScreenerIndexCardsCache(marketCacheSegment, initialCards);
      }
    }
  }, [initialCards, marketCacheSegment]);

  useEffect(() => {
    if (!marketCacheSegment) return;

    if (Array.isArray(initialCards) && initialCards.length > 0) return;

    const sessionCached = readScreenerIndexCardsCache(marketCacheSegment);
    if (sessionCached?.length) {
      setCards(sessionCached);
      return;
    }

    let cancelled = false;
    const cacheKey = `${marketCacheSegment}|index-cards`;
    void fetchScreenerIndexCardsCached(marketCacheSegment, cacheKey)
      .then((next) => {
        if (cancelled || !next.length) return;
        setCards(next);
      })
      .catch(() => {
        /* keep SSR + local fallbacks */
      });

    return () => {
      cancelled = true;
    };
  }, [marketCacheSegment, initialCards]);

  const entries = useMemo(() => entriesFromCards(cards), [cards]);
  const fadeIn = true;

  return (
    <div className={INDEX_CARDS_SCROLL_OUTER_CLASS}>
      <div className={INDEX_CARDS_SCROLL_CLASS} aria-label="Market indices">
        <div className={INDEX_CARDS_GRID_CLASS}>
        {entries.map(({ name, value, change, positive, neutral }) => {
          const TrendIcon = neutral ? null : positive ? ArrowUp : ArrowDown;
          return (
            <div key={name} className={INDEX_CARD_SURFACE_CLASS}>
              <p className="w-full truncate text-left text-[13px] font-medium leading-4 text-[#09090B] sm:text-[14px] sm:leading-5">
                {name}
              </p>
              <FadeIn show={fadeIn}>
                <p
                  className="w-full truncate text-left text-[15px] font-bold leading-5 tabular-nums text-[#09090B] sm:text-base sm:leading-6"
                  suppressHydrationWarning
                >
                  {value}
                </p>
              </FadeIn>
              <FadeIn show={fadeIn}>
                <div
                  className={`flex w-full items-center gap-1 text-left text-[13px] font-medium leading-4 tabular-nums sm:text-[14px] sm:leading-5 ${
                    neutral ? "text-[#71717A]" : positive ? "text-[#16A34A]" : "text-[#DC2626]"
                  }`}
                  suppressHydrationWarning
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
    </div>
  );
}
