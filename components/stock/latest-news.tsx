"use client";

import Link from "next/link";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  MOBILE_ELEVATED_CARD_CLASS,
  STOCK_OVERVIEW_SECTION_HEADING_CLASS,
} from "@/components/design-system/card-surface-styles";
import { SkeletonBox } from "@/components/markets/skeleton";
import { CompanyLogo } from "@/components/screener/company-logo";
import { getCryptoLogoUrl } from "@/lib/crypto/crypto-logo-url";
import {
  MOBILE_NEWS_CAROUSEL_COUNT,
  STOCK_NEWS_PAGE_SIZE,
  type StockNewsArticle,
} from "@/lib/market/stock-news-types";
import { logoDevStockLogoUrl } from "@/lib/screener/company-logo-url";
import { cn } from "@/lib/utils";

const PAGE_SIZE = STOCK_NEWS_PAGE_SIZE;

const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;

function formatAbsoluteDateUs(iso: string): string {
  const d = new Date(iso);
  const t = d.getTime();
  if (!Number.isFinite(t)) return "";
  const m = MONTHS_SHORT[d.getUTCMonth()];
  const day = d.getUTCDate();
  const y = d.getUTCFullYear();
  return `${m} ${day}, ${y}`;
}

function formatPublishedLabel(iso: string): string {
  const d = Date.parse(iso);
  if (!Number.isFinite(d)) return "";
  const diffMs = Math.max(0, Date.now() - d);
  const sec = Math.floor(diffMs / 1000);
  const min = Math.floor(sec / 60);
  const hr = Math.floor(min / 60);
  const day = Math.floor(hr / 24);
  if (day > 14) {
    return formatAbsoluteDateUs(iso);
  }
  if (day >= 1) return `${day}d ago`;
  if (hr >= 1) return `${hr}h ago`;
  if (min >= 1) return `${min}m ago`;
  return "Just now";
}

const NEWS_GRID_CLASS = "grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3";

function assetNewsSeeAllHref(sym: string, variant: "stock" | "crypto"): string {
  const encoded = encodeURIComponent(sym);
  return variant === "crypto" ? `/crypto/${encoded}/news` : `/stock/${encoded}/news`;
}

function NewsRowSkeleton() {
  return (
    <div className="py-1" aria-hidden>
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <SkeletonBox className="h-3 w-20" />
          <SkeletonBox className="h-3 w-24" />
        </div>
        <SkeletonBox className="h-4 w-full" />
      </div>
    </div>
  );
}

function MobileNewsCardSkeleton() {
  return (
    <div
      className={cn(
        "flex h-[9rem] w-[min(72vw,17.5rem)] shrink-0 flex-col px-3 pt-3 pb-2",
        MOBILE_ELEVATED_CARD_CLASS,
      )}
      aria-hidden
    >
      <SkeletonBox className="h-3 w-28" />
      <div className="mt-2 flex flex-col gap-2">
        <SkeletonBox className="h-3.5 w-full" />
        <SkeletonBox className="h-3.5 w-[92%]" />
        <SkeletonBox className="h-3.5 w-[78%]" />
      </div>
      <SkeletonBox className="mt-2 h-5 w-14 rounded-md" />
    </div>
  );
}

function decodeNewsTitle(title: string): string {
  return title
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

/** Mobile news card title: 3 lines at `text-[14px]` / `leading-5` (20px). */
const MOBILE_NEWS_TITLE_CLASS =
  "overflow-hidden text-[14px] font-semibold leading-5 text-[#0F0F0F] [display:-webkit-box] [-webkit-line-clamp:3] [-webkit-box-orient:vertical] max-h-[3.75rem] break-words";

function MobileNewsCard({
  item,
  symbol,
  logoUrl,
}: {
  item: StockNewsArticle;
  symbol: string;
  logoUrl: string;
}) {
  return (
    <a
      href={item.url}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "group flex h-[9rem] w-[min(72vw,17.5rem)] shrink-0 flex-col overflow-hidden px-3 pt-3 pb-2 no-underline",
        MOBILE_ELEVATED_CARD_CLASS,
      )}
    >
      <p className="flex shrink-0 items-center gap-1.5 truncate text-[12px] leading-4 text-[#71717A]">
        <span className="font-medium text-[#0F0F0F]">{item.source}</span>
        <span className="inline-block size-1 shrink-0 rounded-full bg-[#E4E4E7]" aria-hidden />
        {formatPublishedLabel(item.publishedAt)}
      </p>
      <h3 className={cn("mt-2 shrink-0 group-hover:underline", MOBILE_NEWS_TITLE_CLASS)}>
        {decodeNewsTitle(item.title)}
      </h3>
      <div className="mt-2 flex shrink-0 items-center gap-1.5">
        <CompanyLogo name={symbol} symbol={symbol} logoUrl={logoUrl} size="xs" />
        <span className="inline-flex h-6 max-w-[8rem] items-center rounded-md border border-[#E4E4E7] bg-white px-2 text-[12px] font-semibold leading-4 text-[#0F0F0F] shadow-[0px_1px_2px_0px_rgba(10,10,10,0.06)]">
          <span className="truncate">{symbol}</span>
        </span>
      </div>
    </a>
  );
}

function LatestNewsHeader({
  title,
  seeAllHref,
  showSeeAll,
}: {
  title: string;
  seeAllHref?: string;
  showSeeAll: boolean;
}) {
  return (
    <div className="mb-3 flex items-center justify-between max-md:px-0 sm:mb-4">
      <h2 className={cn("max-md:text-[18px] max-md:leading-7", STOCK_OVERVIEW_SECTION_HEADING_CLASS)}>{title}</h2>
      {showSeeAll && seeAllHref ? (
        <Link
          href={seeAllHref}
          className="hidden shrink-0 text-[14px] font-semibold leading-5 text-[#2563EB] max-md:inline"
        >
          See all
        </Link>
      ) : null}
    </div>
  );
}

function LatestNewsInner({
  ticker,
  initialItems,
  variant = "stock",
  presentation = "overview",
}: {
  ticker: string;
  initialItems?: StockNewsArticle[];
  variant?: "stock" | "crypto";
  /** `overview` = mobile carousel on asset tab; `full` = list page. */
  presentation?: "overview" | "full";
}) {
  const sym = ticker.trim().toUpperCase();
  const isStock = variant === "stock";
  const isOverview = presentation === "overview";
  const logoUrl = useMemo(
    () => (variant === "crypto" ? getCryptoLogoUrl(sym) : logoDevStockLogoUrl(sym) || ""),
    [sym, variant],
  );
  const seeAllHref = assetNewsSeeAllHref(sym, variant);

  const seed = useMemo(() => {
    if (!Array.isArray(initialItems)) return null;
    if (isStock) return initialItems.slice(0, PAGE_SIZE);
    return initialItems;
  }, [initialItems, isStock]);

  const [items, setItems] = useState<StockNewsArticle[]>(() => seed ?? []);
  const [loading, setLoading] = useState(() => seed == null);
  const [nextOffset, setNextOffset] = useState(() => (isStock ? (seed?.length ?? 0) : 0));
  const [hasMore, setHasMore] = useState(() => (isStock ? (seed?.length ?? 0) > 0 : false));
  const [loadingMore, setLoadingMore] = useState(false);

  const nextOffsetRef = useRef(nextOffset);
  nextOffsetRef.current = nextOffset;

  const loadMoreRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    let mounted = true;
    async function load() {
      if (isStock) {
        if (seed) {
          setItems(seed);
          setNextOffset(seed.length);
          setHasMore(seed.length > 0);
          setLoading(false);
          if (seed.length < PAGE_SIZE) {
            void (async () => {
              try {
                const res = await fetch(
                  `/api/stocks/${encodeURIComponent(sym)}/news?offset=0&limit=${PAGE_SIZE}`,
                  { credentials: "include" },
                );
                if (!mounted || !res.ok) return;
                const json = (await res.json()) as { items?: StockNewsArticle[]; hasMore?: boolean };
                const batch = Array.isArray(json.items) ? json.items : [];
                if (!mounted || batch.length <= seed.length) return;
                setItems(batch);
                setNextOffset(batch.length);
                setHasMore(json.hasMore ?? batch.length === PAGE_SIZE);
              } catch {
                /* keep SSR seed */
              }
            })();
          }
          return;
        }
        setLoading(true);
        try {
          const res = await fetch(
            `/api/stocks/${encodeURIComponent(sym)}/news?offset=0&limit=${PAGE_SIZE}`,
            { credentials: "include" },
          );
          if (!mounted) return;
          if (!res.ok) {
            setItems([]);
            setHasMore(false);
            setLoading(false);
            return;
          }
          const json = (await res.json()) as { items?: StockNewsArticle[]; hasMore?: boolean };
          const batch = Array.isArray(json.items) ? json.items : [];
          setItems(batch);
          setNextOffset(batch.length);
          setHasMore(json.hasMore ?? batch.length === PAGE_SIZE);
        } catch {
          if (!mounted) return;
          setItems([]);
          setHasMore(false);
        } finally {
          if (mounted) setLoading(false);
        }
        return;
      }

      if (seed) {
        setItems(seed);
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const path = `/api/crypto/${encodeURIComponent(sym)}/news`;
        const res = await fetch(path, { credentials: "include" });
        if (!mounted) return;
        if (!res.ok) {
          setItems([]);
          setLoading(false);
          return;
        }
        const json = (await res.json()) as { items?: StockNewsArticle[] };
        if (!mounted) return;
        setItems(Array.isArray(json.items) ? json.items : []);
      } catch {
        if (!mounted) return;
        setItems([]);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    void load();
    return () => {
      mounted = false;
    };
  }, [sym, seed, isStock]);

  const loadMore = useCallback(async () => {
    if (!isStock || loadingMore || loading || !hasMore) return;
    const off = nextOffsetRef.current;
    setLoadingMore(true);
    try {
      const res = await fetch(
        `/api/stocks/${encodeURIComponent(sym)}/news?offset=${off}&limit=${PAGE_SIZE}`,
        { credentials: "include" },
      );
      if (!res.ok) {
        setHasMore(false);
        return;
      }
      const json = (await res.json()) as { items?: StockNewsArticle[]; hasMore?: boolean };
      const batch = Array.isArray(json.items) ? json.items : [];
      setItems((prev) => {
        const seen = new Set(prev.map((x) => x.id));
        const merged = [...prev];
        for (const it of batch) {
          if (!seen.has(it.id)) {
            seen.add(it.id);
            merged.push(it);
          }
        }
        return merged;
      });
      setNextOffset(off + batch.length);
      if (batch.length === 0) setHasMore(false);
      else setHasMore(json.hasMore ?? batch.length === PAGE_SIZE);
    } catch {
      setHasMore(false);
    } finally {
      setLoadingMore(false);
    }
  }, [isStock, sym, hasMore, loadingMore, loading]);

  loadMoreRef.current = loadMore;

  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isStock) return;
    const el = sentinelRef.current;
    if (!el || !hasMore || loading || loadingMore) return;

    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) void loadMoreRef.current?.();
      },
      { root: null, rootMargin: "240px", threshold: 0 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [isStock, hasMore, loading, loadingMore, items.length]);

  const skeletonCount = isStock ? PAGE_SIZE : 10;
  const carouselItems = items.slice(0, MOBILE_NEWS_CAROUSEL_COUNT);
  const headerTitle = isOverview ? "Latest news" : "News";
  const showSeeAll = isOverview && (loading || items.length > 0);

  return (
    <div className={cn(isOverview && "max-md:mb-6")}>
      <LatestNewsHeader title={headerTitle} seeAllHref={seeAllHref} showSeeAll={showSeeAll} />

      {loading ? (
        <>
          <div className="-mr-4 overflow-visible pr-4 max-md:block md:hidden">
            <div className="mobile-scroll-x flex flex-nowrap gap-3">
              {Array.from({ length: MOBILE_NEWS_CAROUSEL_COUNT }).map((_, i) => (
                <MobileNewsCardSkeleton key={i} />
              ))}
            </div>
          </div>
          <div className={cn(NEWS_GRID_CLASS, "hidden max-md:px-0 sm:px-0 md:grid")}>
            {Array.from({ length: skeletonCount }).map((_, i) => (
              <NewsRowSkeleton key={i} />
            ))}
          </div>
        </>
      ) : !loading && items.length === 0 ? (
        <p className="max-md:px-0 py-2 text-[13px] leading-5 text-[#71717A] sm:px-0">No recent news found for {sym}.</p>
      ) : !loading ? (
        <>
          {isOverview ? (
            <div className="-mr-4 mb-0 overflow-visible pr-4 max-md:block md:hidden">
              <div className="mobile-scroll-x flex flex-nowrap gap-3">
                {carouselItems.map((item) => (
                  <MobileNewsCard key={item.id} item={item} symbol={sym} logoUrl={logoUrl} />
                ))}
              </div>
            </div>
          ) : null}

          <div
            className={cn(
              NEWS_GRID_CLASS,
              "max-md:px-0 sm:px-0",
              isOverview ? "hidden md:grid" : "grid",
            )}
          >
            {items.map((item) => (
              <a
                key={item.id}
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group block py-1"
              >
                <div className="mb-1 flex flex-wrap items-center gap-1.5">
                  <span className="text-[12px] text-[#71717A]">{formatPublishedLabel(item.publishedAt)}</span>
                  <span className="inline-block size-1 shrink-0 rounded-full bg-[#E4E4E7]" aria-hidden />
                  <span className="text-[12px] font-medium text-[#0F0F0F]">{item.source}</span>
                </div>
                <h3 className="line-clamp-2 text-[14px] font-semibold leading-5 text-[#0F0F0F] group-hover:underline">
                  {decodeNewsTitle(item.title)}
                </h3>
              </a>
            ))}

            {isStock ? (
              <>
                <div ref={sentinelRef} className="col-span-full h-px w-full" aria-hidden />
                {loadingMore
                  ? Array.from({ length: PAGE_SIZE }).map((_, i) => <NewsRowSkeleton key={`more-${i}`} />)
                  : null}
              </>
            ) : null}
          </div>
        </>
      ) : null}
    </div>
  );
}

export const LatestNews = memo(LatestNewsInner);
