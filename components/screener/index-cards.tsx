"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type CSSProperties, type Ref } from "react";

import { ChangeCaretIcon } from "@/components/screener/change-pct";
import { FadeIn } from "@/components/markets/skeleton";
import { MOBILE_ELEVATED_CARD_CLASS } from "@/components/design-system/card-surface-styles";
import type { IndexCardData } from "@/lib/screener/indices-today";
import { MARKET_INDICES_TODAY } from "@/lib/screener/indices-config";
import { indexAssetHref } from "@/lib/market/index-page-shared";
import { cn } from "@/lib/utils";
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
  href: string | null;
};

/** Non-index tile appended after the index strip (e.g. BTC on Home). */
export type IndexCardExtra = {
  name: string;
  price: number | null;
  changePercent1D: number | null;
  href: string | null;
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
  return `${Math.abs(changePercent1D).toFixed(2)}%`;
}

function toEntry(
  name: string,
  price: number | null,
  pct: number | null,
  href: string | null,
): IndexEntry {
  const value = formatIndexValue(price);
  const change = formatChangePercent(pct);
  const neutral = change === "—" || value === "—";
  const positive = !neutral && (pct ?? 0) >= 0;
  return { name, value, change, positive, neutral, href };
}

function entriesFromCards(cards: IndexCardData[], extras: readonly IndexCardExtra[]): IndexEntry[] {
  const merged = withIndexCardLocalFallbacks(cards);
  const byName = new Map(merged.map((c) => [c.name, c] as const));
  const indexEntries = SCREENER_INDEX_CARD_LABELS.map((name) => {
    const c = byName.get(name);
    const symbol = MARKET_INDICES_TODAY.find((row) => row.name === name)?.eodhdSymbol;
    return toEntry(name, c?.price ?? null, c?.changePercent1D ?? null, symbol ? indexAssetHref(symbol) : null);
  });
  return [...indexEntries, ...extras.map((x) => toEntry(x.name, x.price, x.changePercent1D, x.href))];
}

export const INDEX_CARDS_GRID_CLASS =
  "flex w-max flex-nowrap gap-3 md:grid md:w-full md:max-w-full md:grid-cols-3 md:gap-3 lg:grid-cols-4 xl:grid-cols-5";

/** Outer shell — keeps vertical overflow visible so cards aren’t clipped. Mobile: 16px stack rhythm. */
export const INDEX_CARDS_SCROLL_OUTER_CLASS = "mb-5 max-md:mb-4 overflow-visible";

/** Horizontal scroll track — bleed right for peek; keep left inset with page gutter. No extra top pad (session → cards is 16px). */
export const INDEX_CARDS_SCROLL_CLASS =
  "-mr-4 pl-1 pr-4 mobile-scroll-x md:mx-0 md:overflow-visible md:pl-0 md:pr-0 md:pb-0 md:mb-0";

export const INDEX_CARD_SURFACE_CLASS = cn(
  // Slightly less bottom pad: last row line-box leaves optical space under the % digits.
  "flex w-[7.25625rem] shrink-0 flex-col items-start gap-0.5 overflow-hidden px-3 pt-3.5 pb-2.5 transition max-md:overflow-visible max-md:pt-3.5 max-md:pb-2.5 md:gap-1 sm:px-4 sm:pt-4 sm:pb-3 md:w-auto md:min-w-0 md:shrink",
  MOBILE_ELEVATED_CARD_CLASS,
);

function seedIndexCards(initialCards?: IndexCardData[]): IndexCardData[] {
  if (Array.isArray(initialCards) && initialCards.length > 0) return initialCards;
  return withIndexCardLocalFallbacks([]);
}

const NO_EXTRAS: readonly IndexCardExtra[] = [];

export function IndexCards({
  initialCards,
  marketCacheSegment = "",
  extraCards = NO_EXTRAS,
  outerClassName = INDEX_CARDS_SCROLL_OUTER_CLASS,
  scrollClassName = INDEX_CARDS_SCROLL_CLASS,
  gridClassName = INDEX_CARDS_GRID_CLASS,
  gridStyle,
  cardStyle,
  scrollRef,
}: {
  initialCards?: IndexCardData[];
  /** From SSR stocks payload — live 15m slot or frozen last regular session. */
  marketCacheSegment?: string;
  extraCards?: readonly IndexCardExtra[];
  outerClassName?: string;
  scrollClassName?: string;
  gridClassName?: string;
  gridStyle?: CSSProperties;
  /** Per-card overrides (e.g. tighter row gap on Home). */
  cardStyle?: CSSProperties;
  /** Horizontal scroll track (e.g. for prev/next arrow buttons). */
  scrollRef?: Ref<HTMLDivElement>;
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

  const entries = useMemo(() => entriesFromCards(cards, extraCards), [cards, extraCards]);
  const fadeIn = true;

  return (
    <div className={outerClassName}>
      <div ref={scrollRef} className={scrollClassName} aria-label="Market indices">
        <div className={gridClassName} style={gridStyle}>
        {entries.map(({ name, value, change, positive, neutral, href }) => {
          const body = (
            <>
              <p className="w-full truncate text-left text-[14px] font-medium leading-5 text-fg-muted group-hover:underline group-hover:underline-offset-2">
                {name}
              </p>
              <FadeIn show={fadeIn}>
                <p
                  className="w-full truncate text-left text-[15px] font-bold leading-5 tabular-nums text-fg sm:text-base sm:leading-6"
                  suppressHydrationWarning
                >
                  {value}
                </p>
              </FadeIn>
              <FadeIn show={fadeIn}>
                <div
                  className={`inline-flex w-full items-center gap-1 text-left text-[13px] font-medium leading-none tabular-nums sm:text-[14px] ${
                    neutral ? "text-fg-muted" : positive ? "text-up" : "text-down"
                  }`}
                  suppressHydrationWarning
                >
                  {neutral ? null : (
                    <ChangeCaretIcon direction={positive ? "up" : "down"} />
                  )}
                  <span className="truncate">{change}</span>
                </div>
              </FadeIn>
            </>
          );
          return href ? (
            <Link
              key={name}
              href={href}
              className={cn(INDEX_CARD_SURFACE_CLASS, "group hover:bg-surface-muted/60")}
              style={cardStyle}
            >
              {body}
            </Link>
          ) : (
            <div key={name} className={INDEX_CARD_SURFACE_CLASS} style={cardStyle}>
              {body}
            </div>
          );
        })}
        </div>
      </div>
    </div>
  );
}
