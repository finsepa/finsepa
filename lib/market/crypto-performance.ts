import "server-only";

import { unstable_cache } from "next/cache";

import { REVALIDATE_HOT } from "@/lib/data/cache-policy";
import { fetchEodhdCryptoDailyBarsForMeta } from "@/lib/market/eodhd-crypto";
import { resolveCryptoMetaForProvider } from "@/lib/market/crypto-meta-resolver";
import { computeStockPerformanceFromSortedDailyBars } from "@/lib/market/stock-performance";
import type { StockPerformance } from "@/lib/market/stock-performance-types";

function ymdUtc(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function emptyPerf(routeSymbol: string): StockPerformance {
  const sym = routeSymbol.trim().toUpperCase();
  return {
    ticker: sym,
    price: null,
    d1: null,
    d5: null,
    d7: null,
    m1: null,
    m6: null,
    ytd: null,
    y1: null,
    y5: null,
    y10: null,
    all: null,
  };
}

async function loadCryptoPerformanceUncached(routeSymbol: string): Promise<StockPerformance> {
  const meta = await resolveCryptoMetaForProvider(routeSymbol);
  if (!meta) return emptyPerf(routeSymbol);

  const now = new Date();
  const to = ymdUtc(now);
  const fromDate = new Date(now);
  fromDate.setUTCFullYear(fromDate.getUTCFullYear() - 6);
  const from = ymdUtc(fromDate);

  const bars = await fetchEodhdCryptoDailyBarsForMeta(meta, from, to);
  const sorted = bars?.length ? [...bars].sort((a, b) => a.date.localeCompare(b.date)) : [];

  return computeStockPerformanceFromSortedDailyBars(sorted, meta.symbol, now);
}

export const getCryptoPerformance = unstable_cache(
  async (routeSymbol: string) => loadCryptoPerformanceUncached(routeSymbol),
  ["crypto-performance-v3-ton-pol-eodhd"],
  { revalidate: REVALIDATE_HOT },
);
