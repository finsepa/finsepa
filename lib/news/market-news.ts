import "server-only";

import { cache } from "react";
import { unstable_cache } from "next/cache";

import { REVALIDATE_HOT } from "@/lib/data/cache-policy";
import { getNewsFeed } from "@/lib/news/news-feed";
import type { NewsItem } from "@/lib/news/news-types";

const PAGE_SIZE = 15;
export type MarketNewsTab = "market" | "stocks" | "crypto";

function normalizeQuery(q: string | null | undefined): string {
  return (q ?? "").trim().toLowerCase();
}

async function buildMarketNewsUncached(): Promise<NewsItem[]> {
  const [stocks, crypto, indices] = await Promise.all([
    getNewsFeed("stocks"),
    getNewsFeed("crypto"),
    getNewsFeed("indices"),
  ]);

  const merged = [...stocks, ...crypto, ...indices];
  merged.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));

  // De-dupe by URL when possible (same article syndicated across assets).
  const seen = new Set<string>();
  const out: NewsItem[] = [];
  for (const item of merged) {
    const key = item.url ?? `${item.title}|${item.publishedAt}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
    // Keep this bounded — we only paginate a small list.
    if (out.length >= 500) break;
  }
  return out;
}

const getMarketNewsData = unstable_cache(buildMarketNewsUncached, ["market-news-v1"], {
  revalidate: REVALIDATE_HOT,
});

export const getMarketNewsFeed = cache(async () => getMarketNewsData());

const getStocksFeed = unstable_cache(async () => getNewsFeed("stocks"), ["news-feed-stocks-v1-15"], {
  revalidate: REVALIDATE_HOT,
});

const getCryptoFeed = unstable_cache(async () => getNewsFeed("crypto"), ["news-feed-crypto-v1-15"], {
  revalidate: REVALIDATE_HOT,
});

async function getFeedForTab(tab: MarketNewsTab): Promise<NewsItem[]> {
  if (tab === "stocks") return getStocksFeed();
  if (tab === "crypto") return getCryptoFeed();
  return getMarketNewsFeed();
}

export async function getMarketNewsPage(params: {
  page: number;
  q?: string | null | undefined;
}): Promise<{ total: number; pageSize: number; items: NewsItem[] }> {
  const feed = await getMarketNewsFeed();
  const q = normalizeQuery(params.q);
  const filtered =
    !q
      ? feed
      : feed.filter((n) => {
          const title = (n.title ?? "").toLowerCase();
          const sym = (n.assetSymbol ?? "").toLowerCase();
          const label = (n.assetLabel ?? "").toLowerCase();
          return title.includes(q) || sym.includes(q) || label.includes(q);
        });

  const page = Math.max(1, Math.floor(params.page || 1));
  const start = (page - 1) * PAGE_SIZE;
  const items = filtered.slice(start, start + PAGE_SIZE);
  return { total: filtered.length, pageSize: PAGE_SIZE, items };
}

export async function getMarketNewsTabPage(params: {
  tab: MarketNewsTab;
  page: number;
  q?: string | null | undefined;
}): Promise<{ total: number; pageSize: number; items: NewsItem[] }> {
  const feed = await getFeedForTab(params.tab);
  const q = normalizeQuery(params.q);
  const filtered =
    !q
      ? feed
      : feed.filter((n) => {
          const title = (n.title ?? "").toLowerCase();
          const sym = (n.assetSymbol ?? "").toLowerCase();
          const label = (n.assetLabel ?? "").toLowerCase();
          return title.includes(q) || sym.includes(q) || label.includes(q);
        });

  const page = Math.max(1, Math.floor(params.page || 1));
  const start = (page - 1) * PAGE_SIZE;
  const items = filtered.slice(start, start + PAGE_SIZE);
  return { total: filtered.length, pageSize: PAGE_SIZE, items };
}

