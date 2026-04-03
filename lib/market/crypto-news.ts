import "server-only";

import { unstable_cache } from "next/cache";

import { REVALIDATE_HOT } from "@/lib/data/cache-policy";
import { getEodhdApiKey } from "@/lib/env/server";
import { ALL_CRYPTO_METAS, toSupportedCryptoTicker } from "@/lib/market/eodhd-crypto";
import type { StockNewsArticle } from "@/lib/market/stock-news-types";
import { extractImageUrlFromPlainText, pickBestImageUrl } from "@/lib/market/stock-news-images";
import { fetchOgImageFromArticleUrl } from "@/lib/market/stock-news-og";

const SUMMARY_MAX = 280;
const MAX_TAGS = 5;

function stripHtml(s: string): string {
  return s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function truncateSummary(text: string): string {
  const t = text.trim();
  if (t.length <= SUMMARY_MAX) return t;
  return `${t.slice(0, SUMMARY_MAX - 1).trim()}…`;
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
  return `cn-${Math.abs(h).toString(36)}`;
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

async function loadCryptoNewsUncached(routeSymbol: string): Promise<StockNewsArticle[]> {
  const key = getEodhdApiKey();
  if (!key) return [];

  const supported = toSupportedCryptoTicker(routeSymbol);
  if (!supported) return [];

  const meta = ALL_CRYPTO_METAS.find((m) => m.symbol.toUpperCase() === supported.toUpperCase());
  if (!meta) return [];

  const url = `https://eodhd.com/api/news?s=${encodeURIComponent(meta.eodhdSymbol)}&offset=0&limit=10&api_token=${encodeURIComponent(key)}&fmt=json`;

  let data: unknown;
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return [];
    data = await res.json();
  } catch {
    return [];
  }

  if (data && typeof data === "object" && "error" in data && (data as { error?: string }).error) {
    return [];
  }

  const rows = normalizeNewsArray(data);
  const out: StockNewsArticle[] = [];

  for (let i = 0; i < rows.length; i++) {
    const raw = rows[i]!;
    const title = typeof raw.title === "string" ? raw.title.trim() : "";
    const link = typeof raw.link === "string" ? raw.link.trim() : "";
    const dateRaw = typeof raw.date === "string" ? raw.date : "";
    if (!title || !link) continue;

    const content = typeof raw.content === "string" ? raw.content : "";
    const summary = truncateSummary(stripHtml(content) || title);

    let tags: string[] = [];
    if (Array.isArray(raw.tags)) {
      tags = raw.tags.filter((t): t is string => typeof t === "string" && t.trim().length > 0).map((t) => t.trim());
    }
    if (tags.length > MAX_TAGS) tags = tags.slice(0, MAX_TAGS);

    const publishedAt = dateRaw || new Date(0).toISOString();

    let imageUrl: string | null = pickBestImageUrl(raw, link, content);
    if (!imageUrl) imageUrl = extractImageUrlFromPlainText(content);

    out.push({
      id: stableId(link, publishedAt, i),
      title,
      source: sourceFromUrl(link),
      publishedAt,
      summary,
      imageUrl,
      url: link,
      tags,
    });

    if (out.length >= 10) break;
  }

  await Promise.all(
    out.map(async (row) => {
      if (row.imageUrl) return;
      const og = await fetchOgImageFromArticleUrl(row.url);
      if (og) row.imageUrl = og;
    }),
  );

  return out;
}

export const getCryptoNews = unstable_cache(
  async (routeSymbol: string) => loadCryptoNewsUncached(routeSymbol),
  ["crypto-news-v1"],
  { revalidate: REVALIDATE_HOT },
);
