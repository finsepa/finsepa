"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import { MOBILE_ELEVATED_CARD_CLASS, STOCK_OVERVIEW_SECTION_HEADING_CLASS } from "@/components/design-system/card-surface-styles";
import { SegmentedControl } from "@/components/design-system/segmented-control";
import {
  whiteSurfaceButtonBorderClass,
  whiteSurfaceButtonShadowClass,
} from "@/components/design-system/secondary-button-styles";
import { usePortfolioWorkspace } from "@/components/portfolio/portfolio-workspace-context";
import { portfolioPageSearchHref } from "@/components/portfolio/portfolio-page-tabs";
import { portfolioIsCombined } from "@/components/portfolio/portfolio-types";
import { EarningsPreviewModal } from "@/components/earnings/earnings-preview-modal";
import { EarningsEmptyIllustration } from "@/components/portfolio-home/portfolio-empty-illustration";
import { CompanyLogo } from "@/components/screener/company-logo";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Spinner } from "@/components/ui/spinner";
import { isSupportedCryptoAssetSymbol } from "@/lib/crypto/crypto-logo-url";
import { portfolioHoldingAssetHref } from "@/lib/crypto/crypto-picker-universe";
import { isCustomPortfolioSymbol } from "@/lib/portfolio/custom-asset-symbol";
import { displayLogoUrlForPortfolioSymbol } from "@/lib/portfolio/portfolio-asset-display-logo";
import { Calendar, ChevronLeft, ChevronRight, Coins } from "@/lib/icons";
import {
  fetchPortfolioEarningsDatesClient,
  portfolioEarningsSymbolsKey,
} from "@/lib/portfolio/portfolio-earnings-dates-client";
import type { PortfolioEarningsDateEntry } from "@/lib/portfolio/portfolio-earnings-dates";
import type {
  PortfolioDividendScheduleRow,
  PortfolioDividendsSchedulePayload,
} from "@/lib/portfolio/portfolio-dividends-schedule-types";
import type { EarningsCalendarItem } from "@/lib/market/earnings-calendar-types";
import { earningsDaysLeftFromYmd } from "@/lib/market/earnings-countdown";
import { useWatchlist as useWatchlistClient } from "@/lib/watchlist/use-watchlist-client";
import { useWatchlistEnrichedItems } from "@/lib/watchlist/use-watchlist-enriched-items";
import { buildWatchlistShellItems } from "@/lib/watchlist/watchlist-shell-items";
import { cn } from "@/lib/utils";

export const MAX_CARDS_PER_ROW = 8;
const MIN_CARDS_PER_ROW = 2;
const CARD_GAP_PX = 12;
const CARD_MIN_WIDTH_PX = 104;
const DATES_MAX_RETRIES = 3;
const DATES_RETRY_BASE_MS = 2_000;

/** Equal columns with no partial peek of the next card. */
export function cardFlex(perRow: number): string {
  return `0 0 calc((100% - ${(perRow - 1) * CARD_GAP_PX}px) / ${perRow})`;
}

/** Visible cards per row: as many as fit at {@link CARD_MIN_WIDTH_PX}, rounded down to an even count. */
export function cardsPerRowForWidth(widthPx: number): number {
  const fit = Math.floor((widthPx + CARD_GAP_PX) / (CARD_MIN_WIDTH_PX + CARD_GAP_PX));
  const even = fit - (fit % 2);
  return Math.min(MAX_CARDS_PER_ROW, Math.max(MIN_CARDS_PER_ROW, even));
}

type UpcomingEventsMode = "earnings" | "dividends";

const MODE_OPTIONS = [
  {
    value: "earnings" as const,
    label: <Calendar className="size-4" strokeWidth={2} aria-hidden />,
    "aria-label": "Upcoming earnings",
  },
  {
    value: "dividends" as const,
    label: <Coins className="size-4" strokeWidth={2} aria-hidden />,
    "aria-label": "Upcoming dividends",
  },
];

export type UpcomingEarningsSourceItem = {
  symbol: string;
  name: string;
  logoUrl: string;
  href?: string | null;
};

type UpcomingEarningsCard = {
  symbol: string;
  name: string;
  logoUrl: string;
  earningsDateDisplay: string;
  earningsDateYmd: string;
  daysLeft: number;
};

function buildCards(
  sources: readonly UpcomingEarningsSourceItem[],
  bySymbol: Record<string, PortfolioEarningsDateEntry>,
): UpcomingEarningsCard[] {
  const cards: UpcomingEarningsCard[] = [];
  const seen = new Set<string>();
  for (const row of sources) {
    const key = row.symbol.trim().toUpperCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    const entry = bySymbol[key];
    if (!entry || entry.notApplicable) continue;
    if (!entry.earningsDateYmd || !entry.earningsDateDisplay) continue;
    // Server `daysLeft` can be a day stale when the response is cached across midnight.
    const daysLeft = earningsDaysLeftFromYmd(entry.earningsDateYmd);
    if (daysLeft == null) continue;
    cards.push({
      symbol: key,
      name: row.name || key,
      logoUrl: row.logoUrl ?? "",
      earningsDateDisplay: entry.earningsDateDisplay,
      earningsDateYmd: entry.earningsDateYmd,
      daysLeft,
    });
  }
  cards.sort((a, b) => {
    if (a.earningsDateYmd !== b.earningsDateYmd) {
      return a.earningsDateYmd.localeCompare(b.earningsDateYmd);
    }
    return a.symbol.localeCompare(b.symbol);
  });
  return cards;
}

type UpcomingDividendCard = {
  symbol: string;
  name: string;
  logoUrl: string;
  href: string | null;
  paymentDateYmd: string;
  daysLeft: number;
  perShareUsd: number;
  /** Per-share amount × shares held across portfolios. */
  receiveUsd: number;
  estimated: boolean;
};

/** Next upcoming payment per held symbol, soonest first. */
function buildDividendCards(
  sources: readonly UpcomingEarningsSourceItem[],
  rows: readonly PortfolioDividendScheduleRow[],
  holderPortfolioIdBySymbol: ReadonlyMap<string, string>,
  sharesHeldBySymbol: ReadonlyMap<string, number>,
): UpcomingDividendCard[] {
  const nextBySymbol = new Map<string, { row: PortfolioDividendScheduleRow; daysLeft: number }>();
  for (const row of rows) {
    const daysLeft = earningsDaysLeftFromYmd(row.paymentDate);
    if (daysLeft == null || daysLeft < 0) continue;
    const prev = nextBySymbol.get(row.symbol);
    if (!prev || row.paymentDate < prev.row.paymentDate) nextBySymbol.set(row.symbol, { row, daysLeft });
  }
  const cards: UpcomingDividendCard[] = [];
  const seen = new Set<string>();
  for (const src of sources) {
    const key = src.symbol.trim().toUpperCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    const next = nextBySymbol.get(key);
    const sharesHeld = sharesHeldBySymbol.get(key) ?? 0;
    if (!next || sharesHeld <= 0) continue;
    cards.push({
      symbol: key,
      name: src.name || key,
      logoUrl: src.logoUrl ?? "",
      href: holderPortfolioIdBySymbol.has(key)
        ? portfolioPageSearchHref(`/home/${holderPortfolioIdBySymbol.get(key)}`, "Dividends")
        : src.href || portfolioHoldingAssetHref(key),
      paymentDateYmd: next.row.paymentDate,
      daysLeft: next.daysLeft,
      perShareUsd: next.row.perShareUsd,
      receiveUsd: next.row.perShareUsd * sharesHeld,
      estimated: next.row.status === "estimated",
    });
  }
  cards.sort((a, b) =>
    a.paymentDateYmd !== b.paymentDateYmd
      ? a.paymentDateYmd.localeCompare(b.paymentDateYmd)
      : a.symbol.localeCompare(b.symbol),
  );
  return cards;
}

function dividendDateLabel(card: UpcomingDividendCard): string {
  if (card.daysLeft === 0) return "Today";
  if (card.daysLeft === 1) return "Tomorrow";
  const [y, m, d] = card.paymentDateYmd.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, d!)).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function formatDividendUsd(value: number): string {
  return `$${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: value < 0.1 ? 4 : 2 })}`;
}

/** Held stocks' dividend schedule — shares = 1 keeps the request cacheable; totals are computed client-side. */
function useUpcomingDividends(symbolsKey: string, enabled: boolean) {
  const [fetched, setFetched] = useState<{ key: string; rows: PortfolioDividendScheduleRow[] | null } | null>(null);

  useEffect(() => {
    if (!enabled || !symbolsKey) return;
    let cancelled = false;
    void (async () => {
      let rows: PortfolioDividendScheduleRow[] | null = null;
      try {
        const res = await fetch("/api/portfolio/dividends-schedule", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ holdings: symbolsKey.split(",").map((symbol) => ({ symbol, shares: 1 })) }),
        });
        if (res.ok) {
          const json = (await res.json()) as PortfolioDividendsSchedulePayload;
          rows = (json.months ?? []).flatMap((m) => m.rows ?? []);
        }
      } catch {
        // show the failed state
      }
      if (!cancelled) setFetched({ key: symbolsKey, rows });
    })();
    return () => {
      cancelled = true;
    };
  }, [enabled, symbolsKey]);

  const current = fetched?.key === symbolsKey ? fetched : null;
  return {
    rows: current?.rows ?? null,
    loading: enabled && symbolsKey !== "" && current == null,
    failed: current != null && current.rows == null,
  };
}

function earningsDateLabel(card: UpcomingEarningsCard): string {
  if (card.daysLeft === 0) return "Today";
  if (card.daysLeft === 1) return "Tomorrow";
  return card.earningsDateDisplay;
}

function earningsPreviewItemFromCard(card: UpcomingEarningsCard): EarningsCalendarItem {
  return {
    ticker: card.symbol,
    companyName: card.name || card.symbol,
    logoUrl: card.logoUrl,
    screenerRank: null,
    reportDate: card.earningsDateYmd,
    timing: "unknown",
    timingLabel: "",
  };
}

function EarningsCard({
  card,
  onOpen,
}: {
  card: UpcomingEarningsCard;
  onOpen: (card: UpcomingEarningsCard) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onOpen(card)}
      aria-label={`${card.symbol} earnings ${earningsDateLabel(card)}`}
      className={cn(
        "group flex h-full w-full min-w-0 cursor-pointer flex-col p-3 text-left transition-colors",
        MOBILE_ELEVATED_CARD_CLASS,
        "hover:bg-surface-muted/60",
      )}
    >
      <CompanyLogo
        name={card.name}
        logoUrl={card.logoUrl}
        symbol={card.symbol}
        size="40"
        className="h-9 w-9 shrink-0 rounded-[10px]"
      />
      <div className="mt-8 min-w-0 space-y-0.5">
        <p className="truncate text-[13px] font-semibold leading-4 text-fg underline-offset-2 decoration-fg-muted group-hover:underline">
          {card.symbol}
        </p>
        <p className="truncate text-[12px] leading-4 text-fg-muted">{earningsDateLabel(card)}</p>
      </div>
    </button>
  );
}

function DividendCard({ card }: { card: UpcomingDividendCard }) {
  const label = dividendDateLabel(card);
  const className = cn(
    "group flex h-full w-full min-w-0 flex-col p-3 text-left transition-colors",
    MOBILE_ELEVATED_CARD_CLASS,
    card.href && "hover:bg-surface-muted/60",
  );
  const content = (
    <>
      <CompanyLogo
        name={card.name}
        logoUrl={card.logoUrl}
        symbol={card.symbol}
        size="40"
        className="h-9 w-9 shrink-0 rounded-[10px]"
      />
      <div className="mt-8 min-w-0 space-y-0.5">
        <p className="truncate text-[13px] font-semibold leading-4 text-fg underline-offset-2 decoration-fg-muted group-hover:underline">
          {card.symbol}
        </p>
        <p className="truncate text-[12px] leading-4 tabular-nums text-fg-muted">
          {label} · {formatDividendUsd(card.receiveUsd)}
        </p>
      </div>
    </>
  );
  const ariaLabel = `${card.symbol} dividend ${formatDividendUsd(card.receiveUsd)} to receive, ${card.estimated ? "estimated " : ""}paid ${label}`;
  return card.href ? (
    <Link href={card.href} aria-label={ariaLabel} className={className}>
      {content}
    </Link>
  ) : (
    <div aria-label={ariaLabel} className={className}>
      {content}
    </div>
  );
}

function CarouselArrowButton({
  direction,
  label,
  onClick,
}: {
  direction: "prev" | "next";
  label: string;
  onClick: () => void;
}) {
  const Icon = direction === "prev" ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      /* Centered on the carousel edge: half of the 32px button sits outside. */
      style={{
        top: "calc(50% - 2px)",
        marginTop: -16,
        ...(direction === "prev" ? { left: -16 } : { right: -16 }),
      }}
      className={cn(
        "absolute z-[2] hidden size-8 items-center justify-center rounded-full bg-button text-fg transition-colors hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fg/15 sm:inline-flex dark:bg-[#2C2C2E]",
        whiteSurfaceButtonBorderClass,
        whiteSurfaceButtonShadowClass,
      )}
    >
      <Icon className="size-4" strokeWidth={2} aria-hidden />
    </button>
  );
}

function EarningsCardSkeleton() {
  return (
    <div className={cn("flex w-full min-w-0 flex-col p-3", MOBILE_ELEVATED_CARD_CLASS)}>
      <div className="h-9 w-9 animate-pulse rounded-[10px] bg-stroke" />
      <div className="mt-8 space-y-1">
        <div className="h-3.5 w-10 animate-pulse rounded bg-stroke" />
        <div className="h-3 w-16 animate-pulse rounded bg-stroke" />
      </div>
    </div>
  );
}

/**
 * Upcoming earnings / dividends cards — watchlist by default, or pass `sourceItems` (e.g. portfolio holdings).
 */
export function UpcomingEarningsCarousel({
  className,
  sourceItems,
  emptyNoSymbols = "Add stocks to a watchlist or portfolio to see upcoming earnings.",
  emptyNoDates = "No upcoming earnings for your watchlists or portfolios.",
}: {
  className?: string;
  /** When set, use these symbols instead of the watchlist. */
  sourceItems?: readonly UpcomingEarningsSourceItem[];
  emptyNoSymbols?: string;
  emptyNoDates?: string;
}) {
  const useWatchlist = sourceItems == null;
  const { stocks, loading: watchlistLoading, ready: watchlistReady } =
    useWatchlistEnrichedItems({ enabled: useWatchlist });
  const sectionRef = useRef<HTMLElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [cardsPerRow, setCardsPerRow] = useState(MAX_CARDS_PER_ROW);
  const [bySymbol, setBySymbol] = useState<Record<string, PortfolioEarningsDateEntry>>({});
  const [datesLoading, setDatesLoading] = useState(false);
  const [datesFailed, setDatesFailed] = useState(false);
  const [datesSettledKey, setDatesSettledKey] = useState<string | null>(null);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);
  const [previewItem, setPreviewItem] = useState<EarningsCalendarItem | null>(null);
  const [mode, setMode] = useState<UpcomingEventsMode>("earnings");
  const isDividends = mode === "dividends";

  const { watchlists, serverSynced: watchlistServerSynced } = useWatchlistClient();
  const { portfolios, holdingsByPortfolioId, portfolioDisplayReady } = usePortfolioWorkspace();

  /** Equities held in any non-combined portfolio (combined books would double count). */
  const heldEquitySources = useMemo((): UpcomingEarningsSourceItem[] => {
    const byKey = new Map<string, UpcomingEarningsSourceItem>();
    for (const p of portfolios) {
      if (portfolioIsCombined(p)) continue;
      for (const h of holdingsByPortfolioId[p.id] ?? []) {
        const key = h.symbol.trim().toUpperCase();
        if (!key || !(h.shares > 0) || byKey.has(key)) continue;
        if (key === "USD" || isSupportedCryptoAssetSymbol(key) || isCustomPortfolioSymbol(key)) continue;
        byKey.set(key, { symbol: key, name: h.name || key, logoUrl: displayLogoUrlForPortfolioSymbol(key) });
      }
    }
    return [...byKey.values()];
  }, [portfolios, holdingsByPortfolioId]);

  /** Earnings: stocks from every watchlist plus every portfolio; the active list's enriched rows win on identity. */
  const sources = useMemo((): UpcomingEarningsSourceItem[] => {
    if (sourceItems != null) {
      return sourceItems.map((r) => ({
        symbol: r.symbol,
        name: r.name,
        logoUrl: r.logoUrl,
        href: r.href ?? null,
      }));
    }
    const byKey = new Map<string, UpcomingEarningsSourceItem>();
    const add = (item: UpcomingEarningsSourceItem) => {
      const key = item.symbol.trim().toUpperCase();
      if (key && !byKey.has(key)) byKey.set(key, { ...item, symbol: key });
    };
    for (const r of stocks) add({ symbol: r.symbol, name: r.name, logoUrl: r.logoUrl ?? "", href: r.href || null });
    const allWatchlistTickers = watchlists.flatMap((list) => list.tickers);
    for (const r of buildWatchlistShellItems(allWatchlistTickers)) {
      if (r.kind !== "stock") continue;
      add({ symbol: r.symbol, name: r.name, logoUrl: r.logoUrl || displayLogoUrlForPortfolioSymbol(r.symbol), href: r.href || null });
    }
    for (const h of heldEquitySources) add(h);
    return [...byKey.values()];
  }, [sourceItems, stocks, watchlists, heldEquitySources]);

  const stockSymbols = useMemo(
    () => sources.map((r) => r.symbol.trim().toUpperCase()).filter(Boolean),
    [sources],
  );
  const symbolsKey = useMemo(() => portfolioEarningsSymbolsKey(stockSymbols), [stockSymbols]);
  const noSymbols = stockSymbols.length === 0;
  /** Wait for watchlists + holdings so the symbol set is fetched once, not re-requested as each source lands. */
  const earningsSourcesReady =
    !useWatchlist || (watchlistReady && watchlistServerSynced && portfolioDisplayReady);

  useEffect(() => {
    if (!earningsSourcesReady) return;
    if (!symbolsKey) {
      setBySymbol({});
      setDatesLoading(false);
      setDatesFailed(false);
      setDatesSettledKey(symbolsKey);
      return;
    }
    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let attempt = 0;
    setDatesLoading(true);
    setDatesFailed(false);
    const load = () => {
      void fetchPortfolioEarningsDatesClient(symbolsKey).then((payload) => {
        if (cancelled) return;
        if (payload && Object.keys(payload.bySymbol).length > 0) setBySymbol(payload.bySymbol);
        if ((!payload || payload.incomplete) && attempt < DATES_MAX_RETRIES) {
          attempt += 1;
          retryTimer = setTimeout(load, DATES_RETRY_BASE_MS * attempt);
          return;
        }
        setDatesFailed(!payload || payload.incomplete === true);
        setDatesLoading(false);
        setDatesSettledKey(symbolsKey);
      });
    };
    load();
    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, [earningsSourcesReady, symbolsKey]);

  const cards = useMemo(() => buildCards(sources, bySymbol), [sources, bySymbol]);
  /** Dividends come from holdings only — you only receive them on shares you own. */
  const heldDividendSources = heldEquitySources;
  const dividendSymbolsKey = useMemo(
    () => portfolioEarningsSymbolsKey(heldDividendSources.map((s) => s.symbol)),
    [heldDividendSources],
  );
  const dividends = useUpcomingDividends(dividendSymbolsKey, isDividends);
  /** Symbol → the (non-combined) portfolio holding the largest position in it. */
  const holderPortfolioIdBySymbol = useMemo(() => {
    const best = new Map<string, { id: string; value: number }>();
    for (const p of portfolios) {
      if (portfolioIsCombined(p)) continue;
      for (const h of holdingsByPortfolioId[p.id] ?? []) {
        const key = h.symbol.trim().toUpperCase();
        if (!key || h.shares <= 0) continue;
        const prev = best.get(key);
        if (!prev || h.currentValue > prev.value) best.set(key, { id: p.id, value: h.currentValue });
      }
    }
    return new Map([...best].map(([k, v]) => [k, v.id]));
  }, [portfolios, holdingsByPortfolioId]);
  /** Symbol → total shares across non-combined portfolios (combined books would double count). */
  const sharesHeldBySymbol = useMemo(() => {
    const out = new Map<string, number>();
    for (const p of portfolios) {
      if (portfolioIsCombined(p)) continue;
      for (const h of holdingsByPortfolioId[p.id] ?? []) {
        const key = h.symbol.trim().toUpperCase();
        if (!key || !(h.shares > 0)) continue;
        out.set(key, (out.get(key) ?? 0) + h.shares);
      }
    }
    return out;
  }, [portfolios, holdingsByPortfolioId]);
  const dividendCards = useMemo(
    () =>
      isDividends
        ? buildDividendCards(heldDividendSources, dividends.rows ?? [], holderPortfolioIdBySymbol, sharesHeldBySymbol)
        : [],
    [isDividends, heldDividendSources, dividends.rows, holderPortfolioIdBySymbol, sharesHeldBySymbol],
  );
  const visibleCount = isDividends ? dividendCards.length : cards.length;

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const measure = () => setCardsPerRow(cardsPerRowForWidth(el.clientWidth));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const cardFlexBasis = cardFlex(cardsPerRow);

  const updateScrollState = () => {
    const el = scrollerRef.current;
    if (!el) {
      setCanPrev(false);
      setCanNext(false);
      return;
    }
    const max = el.scrollWidth - el.clientWidth;
    setCanPrev(el.scrollLeft > 2);
    setCanNext(max > 2 && el.scrollLeft < max - 2);
  };

  useEffect(() => {
    updateScrollState();
    const el = scrollerRef.current;
    if (!el) return;
    const onScroll = () => updateScrollState();
    el.addEventListener("scroll", onScroll, { passive: true });
    const ro = new ResizeObserver(() => updateScrollState());
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", onScroll);
      ro.disconnect();
    };
  }, [visibleCount]);

  useEffect(() => {
    scrollerRef.current?.scrollTo({ left: 0 });
  }, [mode]);

  const scrollByPage = (dir: 1 | -1) => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollBy({ left: el.clientWidth * 0.9 * dir, behavior: "smooth" });
  };

  const sourcesReady = isDividends ? portfolioDisplayReady : earningsSourcesReady;
  const sourcesLoading = isDividends ? false : useWatchlist ? watchlistLoading && noSymbols : false;
  const sourcesEmpty = isDividends ? heldDividendSources.length === 0 : noSymbols;

  const modeLoading = isDividends ? dividends.loading : datesLoading || datesSettledKey !== symbolsKey;
  const modeFailed = isDividends ? dividends.failed : datesFailed;
  const showSkeleton =
    (!sourcesReady || sourcesLoading || modeLoading) && visibleCount === 0 && !sourcesEmpty;
  const showEmpty = sourcesReady && !modeLoading && (sourcesEmpty || visibleCount === 0);

  return (
    <section
      ref={sectionRef}
      className={cn("min-w-0", className)}
      aria-label={isDividends ? "Upcoming dividends" : "Upcoming earnings"}
    >
      <div className="mb-5 flex items-center justify-between gap-2">
        <h2 className={cn(STOCK_OVERVIEW_SECTION_HEADING_CLASS, "min-w-0 truncate")}>
          {isDividends ? "Upcoming dividends" : "Upcoming earnings"}
        </h2>
        <div className="flex shrink-0 items-center gap-2">
          <SegmentedControl
            aria-label="Upcoming event type"
            options={MODE_OPTIONS}
            value={mode}
            onChange={setMode}
            size="sm"
          />
        </div>
      </div>

      {showSkeleton ? (
        <div className="flex w-full min-w-0 gap-3 overflow-hidden">
          {Array.from({ length: cardsPerRow }).map((_, i) => (
            <div key={i} className="min-w-0" style={{ flex: cardFlexBasis }}>
              <EarningsCardSkeleton />
            </div>
          ))}
        </div>
      ) : showEmpty ? (
        <Empty variant="card">
          <EmptyHeader>
            <EarningsEmptyIllustration className="mb-4" />
            <EmptyTitle>
              {!sourcesEmpty && modeFailed
                ? isDividends
                  ? "Couldn’t load dividends"
                  : "Couldn’t load earnings dates"
                : isDividends
                  ? "No upcoming dividends"
                  : "No upcoming earnings"}
            </EmptyTitle>
            <EmptyDescription className="max-w-sm">
              {sourcesEmpty
                ? isDividends
                  ? "Add stocks to a portfolio to see upcoming dividends."
                  : emptyNoSymbols
                : modeFailed
                  ? "Refresh to try again."
                  : isDividends
                    ? "No upcoming dividends for your holdings."
                    : emptyNoDates}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="relative">
          <div
            ref={scrollerRef}
            className="mobile-scroll-x flex w-full min-w-0 snap-x snap-mandatory gap-3 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {isDividends
              ? dividendCards.map((card) => (
                  <div key={card.symbol} className="min-w-0 snap-start" style={{ flex: cardFlexBasis }}>
                    <DividendCard card={card} />
                  </div>
                ))
              : cards.map((card) => (
                  <div key={card.symbol} className="min-w-0 snap-start" style={{ flex: cardFlexBasis }}>
                    <EarningsCard card={card} onOpen={(c) => setPreviewItem(earningsPreviewItemFromCard(c))} />
                  </div>
                ))}
          </div>
          {canPrev ? (
            <CarouselArrowButton
              direction="prev"
              label={isDividends ? "Previous dividends" : "Previous earnings"}
              onClick={() => scrollByPage(-1)}
            />
          ) : null}
          {canNext ? (
            <CarouselArrowButton
              direction="next"
              label={isDividends ? "Next dividends" : "Next earnings"}
              onClick={() => scrollByPage(1)}
            />
          ) : null}
        </div>
      )}

      {!isDividends && datesLoading && cards.length > 0 ? (
        <div className="mt-2 flex items-center gap-2 text-[11px] text-fg-muted">
          <Spinner className="size-3 text-[#71717A]" />
          Updating dates…
        </div>
      ) : null}

      <EarningsPreviewModal item={previewItem} onClose={() => setPreviewItem(null)} />
    </section>
  );
}
