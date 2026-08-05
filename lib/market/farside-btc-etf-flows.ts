import "server-only";

import { unstable_cache } from "next/cache";

import { REVALIDATE_STATIC_DAY } from "@/lib/data/cache-policy";
import { parseFarsideBtcEtfFlowTotals } from "@/lib/market/farside-btc-etf-flows-parse";

export { parseFarsideBtcEtfFlowTotals } from "@/lib/market/farside-btc-etf-flows-parse";

/** Farside publishes US spot Bitcoin ETF daily net flows in US$m. */
export const FARSIDE_BTC_ETF_ALL_DATA_URL = "https://farside.co.uk/bitcoin-etf-flow-all-data/";

/**
 * Reader proxies — Farside sits behind Cloudflare that blocks many serverless IPs.
 * Prefer HTTPS Jina; HTTP and direct used as fallbacks.
 */
const FARSIDE_FETCH_URLS = [
  `https://r.jina.ai/https://farside.co.uk/bitcoin-etf-flow-all-data/`,
  `https://r.jina.ai/http://farside.co.uk/bitcoin-etf-flow-all-data/`,
  FARSIDE_BTC_ETF_ALL_DATA_URL,
] as const;

const MIN_FLOW_POINTS = 30;

async function fetchText(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: {
        Accept: "text/html,text/plain,text/markdown,*/*",
        "User-Agent":
          "Mozilla/5.0 (compatible; FinsepaMacro/1.0; +https://finsepa.com; BTC ETF flow chart)",
      },
      // Avoid Next Data Cache storing challenge/empty HTML for a day.
      cache: "no-store",
    });
    if (!res.ok) return null;
    const text = await res.text();
    if (!text || /just a moment|cf-chl|challenge-platform|enable javascript and cookies/i.test(text)) {
      return null;
    }
    return text;
  } catch {
    return null;
  }
}

async function fetchFarsideBtcEtfFlowTotalsUncached(): Promise<Array<{ time: string; value: number }>> {
  for (const url of FARSIDE_FETCH_URLS) {
    const text = await fetchText(url);
    if (!text) continue;
    const points = parseFarsideBtcEtfFlowTotals(text);
    if (points.length >= MIN_FLOW_POINTS) return points;
  }
  return [];
}

/**
 * Only successful pulls are cached. Empty misses throw so Next does not poison the cache
 * (same pattern as stock 1D REST base).
 */
const getFarsideBtcEtfFlowsCachedNonEmpty = unstable_cache(
  async (): Promise<Array<{ time: string; value: number }>> => {
    const points = await fetchFarsideBtcEtfFlowTotalsUncached();
    if (points.length < MIN_FLOW_POINTS) {
      throw new Error("FARSIDE_BTC_ETF_FLOWS_EMPTY");
    }
    return points;
  },
  ["farside-btc-etf-net-flows-v3-jina-https"],
  { revalidate: REVALIDATE_STATIC_DAY },
);

/** Daily US spot Bitcoin ETF aggregate net flow (USD). Source: Farside Investors via reader/direct. */
export async function fetchFarsideBtcEtfNetFlowMacroSeriesCached(): Promise<
  Array<{ time: string; value: number }>
> {
  try {
    return await getFarsideBtcEtfFlowsCachedNonEmpty();
  } catch (err) {
    if (err instanceof Error && err.message === "FARSIDE_BTC_ETF_FLOWS_EMPTY") {
      // Last uncached attempt (dev / transient edge).
      return fetchFarsideBtcEtfFlowTotalsUncached();
    }
    return [];
  }
}
