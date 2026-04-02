import "server-only";

import { unstable_cache } from "next/cache";

import { REVALIDATE_LOGO_METADATA } from "@/lib/data/cache-policy";
import { fetchEodhdFundamentalsJson } from "@/lib/market/eodhd-fundamentals";
import { companyLogoUrlFromDomain } from "@/lib/screener/company-logo-url";
import { TOP10_META, TOP10_TICKERS, type Top10Ticker } from "@/lib/screener/top10-config";

function isTop10Ticker(t: string): t is Top10Ticker {
  return (TOP10_TICKERS as readonly string[]).includes(t);
}

function domainFromWebsiteRaw(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const s = raw.trim();
  if (!s) return null;
  try {
    const u = new URL(s.includes("://") ? s : `https://${s}`);
    const host = u.hostname.replace(/^www\./, "").trim().toLowerCase();
    return host || null;
  } catch {
    return null;
  }
}

/**
 * Canonical stock favicon URL from fundamentals JSON (General + root-level website fields).
 * Same derivation everywhere: screener, header, peers, earnings, search (server).
 */
export function logoUrlFromFundamentalsRoot(root: Record<string, unknown> | null): string {
  if (!root || typeof root !== "object") return "";
  const general =
    root.General && typeof root.General === "object" ? (root.General as Record<string, unknown>) : null;
  const host =
    domainFromWebsiteRaw(general?.WebURL ?? general?.Website ?? general?.URL) ??
    domainFromWebsiteRaw(root.WebURL ?? root.Website ?? root.URL);
  return host ? companyLogoUrlFromDomain(host) : "";
}

async function resolveStockLogoUrlUncached(ticker: string): Promise<string> {
  const t = ticker.trim().toUpperCase();
  if (!t) return "";
  if (isTop10Ticker(t)) return companyLogoUrlFromDomain(TOP10_META[t].domain);
  const root = await fetchEodhdFundamentalsJson(t);
  return logoUrlFromFundamentalsRoot(root);
}

/**
 * Per-ticker derived logo URL, cached much longer than quote/fundamentals hot paths.
 * Underlying `fetchEodhdFundamentalsJson` is still deduped when this misses.
 */
export const getCachedStockLogoUrl = unstable_cache(
  async (ticker: string) => resolveStockLogoUrlUncached(ticker),
  ["stock-logo-url-v1"],
  { revalidate: REVALIDATE_LOGO_METADATA },
);
