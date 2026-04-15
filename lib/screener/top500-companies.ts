import "server-only";

import { cache } from "react";
import { unstable_cache } from "next/cache";

import { REVALIDATE_STATIC } from "@/lib/data/cache-policy";
import { type EodhdTopUniverseRow, fetchEodhdTopByMarketCap } from "@/lib/market/eodhd-screener";
import { filterUniverseRowsRemovingOtcDuplicates } from "@/lib/market/otc-duplicate-tickers";

export type TopCompanyUniverseRow = EodhdTopUniverseRow;

async function buildTop500UniverseUncached(): Promise<TopCompanyUniverseRow[]> {
  const pages = [0, 100, 200, 300, 400];
  const settled = await Promise.allSettled(pages.map((offset) => fetchEodhdTopByMarketCap({ limit: 100, offset })));

  const combined: TopCompanyUniverseRow[] = [];
  for (const s of settled) {
    if (s.status !== "fulfilled") continue;
    for (const r of s.value) {
      combined.push(r);
    }
  }

  // De-dupe by ticker (provider occasionally repeats due to listing quirks).
  const byTicker = new Map<string, TopCompanyUniverseRow>();
  for (const r of combined) {
    const prev = byTicker.get(r.ticker);
    if (!prev || r.marketCapUsd > prev.marketCapUsd) byTicker.set(r.ticker, r);
  }

  const out = Array.from(byTicker.values());
  out.sort((a, b) => b.marketCapUsd - a.marketCapUsd || a.ticker.localeCompare(b.ticker));
  const withoutOtcDupes = filterUniverseRowsRemovingOtcDuplicates(out);
  return withoutOtcDupes.slice(0, 500);
}

const getTop500UniverseData = unstable_cache(buildTop500UniverseUncached, ["screener-top500-universe-v6-otc-dedupe"], {
  revalidate: REVALIDATE_STATIC,
});

/** Cached across requests; returns exactly 500 tickers when available. */
export const getTop500Universe = cache(async () => getTop500UniverseData());

