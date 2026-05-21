import "server-only";

import { unstable_cache } from "next/cache";

import { REVALIDATE_HOT } from "@/lib/data/cache-policy";

import {
  CRYPTO_TOP10,
  type SupportedCryptoTicker,
  fetchCryptoMarketCapUsdForMeta,
  fetchEodhdCryptoDailyBarsForMeta,
  lastPositiveCloseFromCryptoBars,
} from "@/lib/market/eodhd-crypto";
import { getCryptoLogoUrl } from "@/lib/crypto/crypto-logo-url";
import { deriveMetricsFromDailyBars, eodFetchWindowUtc, formatMarketCapDisplay } from "@/lib/screener/eod-derived-metrics";
export type CryptoTop10Row = {
  symbol: SupportedCryptoTicker;
  name: string;
  price: number | null;
  changePercent1D: number | null;
  changePercent1M: number | null;
  changePercentYTD: number | null;
  marketCap: string;
  sparkline5d: number[];
  logoUrl: string;
};

function changePercent(current: number | null, prev: number | null): number | null {
  if (current == null || prev == null) return null;
  if (!Number.isFinite(current) || !Number.isFinite(prev) || prev === 0) return null;
  return ((current - prev) / prev) * 100;
}

async function buildCryptoRow(meta: (typeof CRYPTO_TOP10)[number]): Promise<CryptoTop10Row> {
  const window = eodFetchWindowUtc();
  const logoUrl = getCryptoLogoUrl(meta.symbol);

  const dailyBars = await fetchEodhdCryptoDailyBarsForMeta(meta, window.from, window.to);
  const lastBar = dailyBars && dailyBars.length ? dailyBars[dailyBars.length - 1]! : null;
  const prevBar = dailyBars && dailyBars.length >= 2 ? dailyBars[dailyBars.length - 2]! : null;

  const currentPrice = lastBar?.close ?? null;
  const change1D = changePercent(currentPrice, prevBar?.close ?? null);
  const derived = dailyBars ? deriveMetricsFromDailyBars(dailyBars, currentPrice ?? NaN) : null;
  const sparkline5d = derived?.sparkline5d ?? [];
  const change1M = derived?.changePercent1M ?? null;
  const changeYTD = derived?.changePercentYTD ?? null;

  const marketCapUsd = await fetchCryptoMarketCapUsdForMeta(meta, lastPositiveCloseFromCryptoBars(dailyBars));
  const marketCapRaw = formatMarketCapDisplay(marketCapUsd);
  const marketCap = marketCapRaw.startsWith("$") ? marketCapRaw.slice(1) : marketCapRaw;

  return {
    symbol: meta.symbol,
    name: meta.name,
    price: currentPrice,
    changePercent1D: change1D,
    changePercent1M: change1M,
    changePercentYTD: changeYTD,
    marketCap,
    sparkline5d,
    logoUrl,
  };
}

async function loadCryptoTop10Uncached(): Promise<CryptoTop10Row[]> {
  const rows = await Promise.all(
    CRYPTO_TOP10.map((meta) => buildCryptoRow(meta)),
  );

  // Keep stable order exactly as requested.
  const indexBySymbol = new Map(rows.map((r, i) => [r.symbol, i]));
  void indexBySymbol;

  return rows;
}

export const getCryptoTop10 = unstable_cache(loadCryptoTop10Uncached, ["crypto-top10-v4-ton-pol-eodhd"], {
  revalidate: REVALIDATE_HOT,
});

