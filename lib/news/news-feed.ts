import "server-only";

import { cache } from "react";
import { unstable_cache } from "next/cache";

import { REVALIDATE_HOT } from "@/lib/data/cache-policy";

import { getEodhdApiKey } from "@/lib/env/server";
import { toEodhdUsSymbol } from "@/lib/market/eodhd-symbol";
import { CRYPTO_TOP10 } from "@/lib/market/eodhd-crypto";
import { INDEX_TOP10 } from "@/lib/market/indices-top10";
import { getTop500Universe } from "@/lib/screener/top500-companies";
import type { NewsItem, NewsTab } from "@/lib/news/news-types";

const PAGE_SIZE = 25;
const PER_SYMBOL_LIMIT = 6;
const MAX_FEED_ITEMS = 250;

function stripHtml(s: string): string {
  return s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function sourceFromUrl(link: string): string {
  try {
    const u = new URL(link);
    const host = u.hostname.replace(/^www\./, "");
    const parts = host.split(".");
    const base = parts.length >= 2 ? parts[parts.length - 2] : host;
    if (!base) return host;
    return base.charAt(0).toUpperCase() + base.slice(1);
  } catch {
    return "News";
  }
}

function stableId(link: string, date: string, index: number): string {
  const b = `${link}|${date}|${index}`;
  let h = 0;
  for (let i = 0; i < b.length; i++) h = (Math.imul(31, h) + b.charCodeAt(i)) | 0;
  return `news-${Math.abs(h).toString(36)}`;
}

function normalizeNewsArray(data: unknown): Record<string, unknown>[] {
  if (Array.isArray(data)) return data as Record<string, unknown>[];
  if (data && typeof data === "object") {
    const o = data as Record<string, unknown>;
    if (Array.isArray(o.data)) return o.data as Record<string, unknown>[];
    if (Array.isArray(o.news)) return o.news as Record<string, unknown>[];
  }
  return [];
}

function parsePublishedAt(raw: unknown): string {
  if (typeof raw === "string" && raw.trim()) return raw;
  return new Date(0).toISOString();
}

async function fetchEodhdNewsForSymbol(eodhdSymbol: string): Promise<Record<string, unknown>[]> {
  const key = getEodhdApiKey();
  if (!key) return [];

  const url = `https://eodhd.com/api/news?s=${encodeURIComponent(eodhdSymbol)}&offset=0&limit=${PER_SYMBOL_LIMIT}&api_token=${encodeURIComponent(
    key,
  )}&fmt=json`;

  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return [];
    const data = (await res.json()) as unknown;
    if (data && typeof data === "object" && "error" in data && (data as { error?: string }).error) return [];
    return normalizeNewsArray(data);
  } catch {
    return [];
  }
}

async function buildTabUniverse(tab: NewsTab): Promise<Array<{ label: string; symbol: string; eodhdSymbol: string }>> {
  if (tab === "indices") {
    return INDEX_TOP10.map((i) => ({ label: i.name, symbol: i.symbol, eodhdSymbol: i.symbol }));
  }
  if (tab === "crypto") {
    // MVP: use the featured crypto universe (still within supported assets).
    return CRYPTO_TOP10.map((c) => ({ label: c.name, symbol: c.symbol, eodhdSymbol: c.eodhdSymbol }));
  }
  const top = await getTop500Universe();
  // Keep MVP fast: pull news from the largest names only (still within supported dataset).
  return top.slice(0, 60).map((c) => ({
    label: c.name,
    symbol: c.ticker,
    eodhdSymbol: toEodhdUsSymbol(c.ticker),
  }));
}

async function buildNewsFeedUncached(tab: NewsTab): Promise<NewsItem[]> {
  const universe = await buildTabUniverse(tab);

  const settled = await Promise.allSettled(
    universe.map(async (u) => {
      const rows = await fetchEodhdNewsForSymbol(u.eodhdSymbol);
      return { u, rows } as const;
    }),
  );

  const seenUrl = new Set<string>();
  const items: NewsItem[] = [];

  for (const s of settled) {
    if (s.status !== "fulfilled") continue;
    const { u, rows } = s.value;

    for (let i = 0; i < rows.length; i++) {
      const raw = rows[i]!;
      const title = typeof raw.title === "string" ? raw.title.trim() : "";
      const link = typeof raw.link === "string" ? raw.link.trim() : "";
      const date = parsePublishedAt(raw.date);
      if (!title) continue;

      const url = link || null;
      if (url && seenUrl.has(url)) continue;
      if (url) seenUrl.add(url);

      items.push({
        id: stableId(url ?? title, date, i),
        title: stripHtml(title),
        url,
        source: url ? sourceFromUrl(url) : "News",
        publishedAt: date,
        assetLabel: u.label,
        assetSymbol: u.symbol,
        assetType: tab,
      });

      if (items.length >= MAX_FEED_ITEMS) break;
    }
    if (items.length >= MAX_FEED_ITEMS) break;
  }

  items.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
  return items;
}

const getNewsFeedData = unstable_cache(buildNewsFeedUncached, ["news-feed-v2"], { revalidate: REVALIDATE_HOT });

export const getNewsFeed = cache(async (tab: NewsTab) => getNewsFeedData(tab));

export async function getNewsPage(tab: NewsTab, page: number): Promise<{ total: number; items: NewsItem[] }> {
  const feed = await getNewsFeed(tab);
  const p = Math.max(1, Math.floor(page));
  const start = (p - 1) * PAGE_SIZE;
  const slice = feed.slice(start, start + PAGE_SIZE);
  return { total: feed.length, items: slice };
}

