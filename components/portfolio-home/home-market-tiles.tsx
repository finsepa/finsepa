"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";

import { IndexCardSkeleton } from "@/components/markets/markets-skeletons";
import { CarouselArrowButton } from "@/components/portfolio-home/upcoming-earnings-carousel";
import {
  INDEX_CARDS_SCROLL_CLASS,
  IndexCards,
  type IndexCardExtra,
} from "@/components/screener/index-cards";
import type { IndexCardData } from "@/lib/screener/indices-today";
import { fetchScreenerIndexCardsCached } from "@/lib/screener/screener-index-cards-cache";
import { SCREENER_INDEX_CARD_LABELS } from "@/lib/screener/screener-index-card-fallbacks";
import { cn } from "@/lib/utils";

const HOME_TILES_OUTER_CLASS = "overflow-visible";
const HOME_TILE_CARD_STYLE: CSSProperties = { rowGap: 0 };
const HOME_TILES_GRID_CLASS = "flex w-max flex-nowrap gap-3 md:grid md:w-full md:max-w-full md:gap-3";
/**
 * Single row from `md` (grid): tiles share the width, never narrower than the Markets tile.
 * Inline so it doesn't depend on new utility classes; ignored below `md` where the row is flex.
 */
const HOME_TILES_GRID_STYLE = {
  gridAutoFlow: "column",
  gridAutoColumns: "minmax(7.25rem, 1fr)",
} as const;
const HOME_TILES_SCROLL_CLASS = cn(
  INDEX_CARDS_SCROLL_CLASS,
  "md:overflow-x-auto md:[scrollbar-width:none] md:[&::-webkit-scrollbar]:hidden",
);

const BTC_TILE_NAME = "Bitcoin";
const BTC_ENRICH_TICKER = "BTC-USD";
const BTC_HREF = "/crypto/BTC";

type EnrichCryptoRow = { symbol?: string; price?: number | null; pct1d?: number | null };

async function fetchBtcQuote(): Promise<{ price: number | null; pct1d: number | null } | null> {
  const res = await fetch("/api/watchlist/enrich", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ tickers: [BTC_ENRICH_TICKER] }),
  });
  if (!res.ok) return null;
  const json = (await res.json()) as { crypto?: EnrichCryptoRow[] };
  const row = json.crypto?.find((r) => r.symbol?.toUpperCase() === "BTC") ?? json.crypto?.[0];
  if (!row) return null;
  return {
    price: typeof row.price === "number" ? row.price : null,
    pct1d: typeof row.pct1d === "number" ? row.pct1d : null,
  };
}

/** Home strip: major US indices (incl. VIX) + Bitcoin, same tile style as Markets. */
export function HomeMarketTiles() {
  const [cards, setCards] = useState<IndexCardData[] | null>(null);
  const [btc, setBtc] = useState<{ price: number | null; pct1d: number | null } | null>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);
  const loaded = cards != null && btc != null;

  useEffect(() => {
    const el = scrollerRef.current;
    if (!loaded || !el) return;
    const update = () => {
      const max = el.scrollWidth - el.clientWidth;
      setCanPrev(el.scrollLeft > 2);
      setCanNext(max > 2 && el.scrollLeft < max - 2);
    };
    update();
    el.addEventListener("scroll", update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", update);
      ro.disconnect();
    };
  }, [loaded]);

  const scrollByPage = (dir: 1 | -1) => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollBy({ left: el.clientWidth * 0.9 * dir, behavior: "smooth" });
  };

  useEffect(() => {
    let cancelled = false;
    void fetchScreenerIndexCardsCached("", "home|index-cards")
      .then((next) => {
        if (!cancelled) setCards(next);
      })
      .catch(() => {
        if (!cancelled) setCards([]);
      });
    void fetchBtcQuote()
      .then((q) => {
        if (!cancelled) setBtc(q ?? { price: null, pct1d: null });
      })
      .catch(() => {
        if (!cancelled) setBtc({ price: null, pct1d: null });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const extraCards = useMemo(
    (): IndexCardExtra[] => [
      {
        name: BTC_TILE_NAME,
        price: btc?.price ?? null,
        changePercent1D: btc?.pct1d ?? null,
        href: BTC_HREF,
      },
    ],
    [btc],
  );

  if (!loaded) {
    return (
      <div className={HOME_TILES_OUTER_CLASS} aria-busy="true">
        <div className={HOME_TILES_SCROLL_CLASS}>
          <div className={HOME_TILES_GRID_CLASS} style={HOME_TILES_GRID_STYLE}>
            {[...SCREENER_INDEX_CARD_LABELS, BTC_TILE_NAME].map((name) => (
              <IndexCardSkeleton key={name} name={name} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      <IndexCards
        initialCards={cards}
        extraCards={extraCards}
        outerClassName={HOME_TILES_OUTER_CLASS}
        scrollClassName={HOME_TILES_SCROLL_CLASS}
        gridClassName={HOME_TILES_GRID_CLASS}
        gridStyle={HOME_TILES_GRID_STYLE}
        cardStyle={HOME_TILE_CARD_STYLE}
        scrollRef={scrollerRef}
      />
      {canPrev ? (
        <CarouselArrowButton direction="prev" label="Previous market tiles" onClick={() => scrollByPage(-1)} />
      ) : null}
      {canNext ? (
        <CarouselArrowButton direction="next" label="Next market tiles" onClick={() => scrollByPage(1)} />
      ) : null}
    </div>
  );
}
