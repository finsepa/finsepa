import "server-only";

import { cache } from "react";
import { unstable_cache } from "next/cache";

import { REVALIDATE_STATIC } from "@/lib/data/cache-policy";
import { type EodhdTopUniverseRow, fetchEodhdTopByMarketCap } from "@/lib/market/eodhd-screener";
import { filterUniverseRowsRemovingOtcDuplicates } from "@/lib/market/otc-duplicate-tickers";
import { filterIssuerLineDuplicatesInUniverse } from "@/lib/screener/universe-issuer-dedupe";

export type TopCompanyUniverseRow = EodhdTopUniverseRow;

function mergeUniversePages(pages: readonly EodhdTopUniverseRow[][]): TopCompanyUniverseRow[] {
  const combined = pages.flat();
  const byTicker = new Map<string, TopCompanyUniverseRow>();
  for (const r of combined) {
    const prev = byTicker.get(r.ticker);
    if (!prev || r.marketCapUsd > prev.marketCapUsd) byTicker.set(r.ticker, r);
  }
  const out = Array.from(byTicker.values());
  out.sort((a, b) => b.marketCapUsd - a.marketCapUsd || a.ticker.localeCompare(b.ticker));
  return filterIssuerLineDuplicatesInUniverse(filterUniverseRowsRemovingOtcDuplicates(out));
}

async function fetchScreenerPageGroup(offsets: readonly number[]): Promise<EodhdTopUniverseRow[][]> {
  const settled = await Promise.allSettled(offsets.map((offset) => fetchEodhdTopByMarketCap({ limit: 100, offset })));
  const pages: EodhdTopUniverseRow[][] = [];
  for (const s of settled) {
    pages.push(s.status === "fulfilled" ? s.value : []);
  }
  return pages;
}

async function buildTop500UniverseUncached(): Promise<TopCompanyUniverseRow[]> {
  const wave1 = await fetchScreenerPageGroup([0, 100, 200, 300, 400]);
  let merged = mergeUniversePages(wave1);
  /** ETFs are stripped in {@link fetchEodhdTopByMarketCap}; pull deeper offsets so we still fill ~500 equities. */
  if (merged.length < 500) {
    const wave2 = await fetchScreenerPageGroup([500, 600, 700, 800, 900]);
    merged = mergeUniversePages([...wave1, ...wave2]);
  }
  return merged.slice(0, 500);
}

const getTop500UniverseData = unstable_cache(buildTop500UniverseUncached, ["screener-top500-universe-v11-preferred-suffix"], {
  revalidate: REVALIDATE_STATIC,
});

/** Cached across requests; returns up to 500 US equity rows (ETFs/ETNs excluded). */
export const getTop500Universe = cache(async () => getTop500UniverseData());
