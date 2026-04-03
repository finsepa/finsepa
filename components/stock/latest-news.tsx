"use client";

import { memo, useEffect, useMemo, useState } from "react";

import { SkeletonBox } from "@/components/markets/skeleton";
import type { StockNewsArticle } from "@/lib/market/stock-news-types";

const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;

/**
 * Calendar date identical on server and client (no `toLocale*` / host locale).
 * US-style: "Mar 18, 2024" — matches finance sites like Stock Analysis.
 */
function formatAbsoluteDateUs(iso: string): string {
  const d = new Date(iso);
  const t = d.getTime();
  if (!Number.isFinite(t)) return "";
  const m = MONTHS_SHORT[d.getUTCMonth()];
  const day = d.getUTCDate();
  const y = d.getUTCFullYear();
  return `${m} ${day}, ${y}`;
}

/** Compact relative labels (`3h ago`, `2d ago`) — same logic server/client; no `toLocale*` drift. */
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

function NewsRowSkeleton() {
  return (
    <div className="border-b border-[#E4E4E7] py-4 -mx-4 px-4">
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <SkeletonBox className="h-3 w-20" />
          <SkeletonBox className="h-3 w-24" />
        </div>
        <SkeletonBox className="h-4 w-full max-w-xl" />
        <SkeletonBox className="h-4 w-full max-w-lg" />
        <div className="flex gap-1.5 pt-1">
          <SkeletonBox className="h-5 w-14 rounded-md" />
          <SkeletonBox className="h-5 w-16 rounded-md" />
        </div>
      </div>
    </div>
  );
}

function LatestNewsInner({
  ticker,
  initialItems,
  variant = "stock",
}: {
  ticker: string;
  initialItems?: StockNewsArticle[];
  variant?: "stock" | "crypto";
}) {
  const sym = ticker.trim().toUpperCase();
  const seed = useMemo(() => (Array.isArray(initialItems) ? initialItems : null), [initialItems]);
  const [loading, setLoading] = useState(seed == null);
  const [items, setItems] = useState<StockNewsArticle[]>(seed ?? []);

  useEffect(() => {
    let cancelled = false;
    let mounted = true;
    async function load() {
      // SSR preloaded news: render instantly, no client fetch / skeleton flash.
      if (seed) {
        setItems(seed);
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const path =
          variant === "crypto"
            ? `/api/crypto/${encodeURIComponent(sym)}/news`
            : `/api/stocks/${encodeURIComponent(sym)}/news`;
        const res = await fetch(path, { credentials: "include" });
        if (!res.ok) {
          if (!mounted) return;
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
      cancelled = true;
    };
  }, [sym, seed, variant]);

  return (
    <div>
      <h2 className="text-[18px] font-semibold leading-7 text-[#09090B] mb-4">Latest news</h2>

      {loading ? (
        <div className="space-y-0">
          {Array.from({ length: 10 }).map((_, i) => (
            <NewsRowSkeleton key={i} />
          ))}
        </div>
      ) : !loading && items.length === 0 ? (
        <p className="text-[13px] leading-5 text-[#71717A] py-2">No recent news found for {sym}.</p>
      ) : !loading ? (
        <div className="space-y-0">
          {items.map((item) => (
            <a
              key={item.id}
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="block border-b border-[#E4E4E7] py-4 cursor-pointer hover:bg-[#FAFAFA] transition-colors -mx-4 px-4"
            >
              <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                <span className="text-[12px] text-[#71717A]">{formatPublishedLabel(item.publishedAt)}</span>
                <span className="text-[#E4E4E7]">·</span>
                <span className="text-[12px] font-medium text-[#09090B]">{item.source}</span>
              </div>
              <h3 className="text-[14px] font-semibold leading-5 text-[#09090B] mb-1 line-clamp-2">{item.title}</h3>
              <p className="text-[13px] leading-5 text-[#71717A] line-clamp-2 mb-2">{item.summary}</p>
              {item.tags.length > 0 ? (
                <div className="flex items-center gap-1.5 flex-wrap">
                  {item.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-md bg-[#F4F4F5] px-2 py-0.5 text-[12px] font-medium text-[#09090B]"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              ) : null}
            </a>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export const LatestNews = memo(LatestNewsInner);
