import "server-only";

import { unstable_cache } from "next/cache";

import {
  toSupportedCryptoTicker,
  type SupportedCryptoTicker,
  CRYPTO_TOP10,
  fetchEodhdCryptoDailyBars,
  fetchEodhdCryptoFundamentalsHighlights,
} from "@/lib/market/eodhd-crypto";
import type { EodhdDailyBar } from "@/lib/market/eodhd-eod";
import { deriveMetricsFromDailyBars, eodFetchWindowUtc, formatMarketCapDisplay } from "@/lib/screener/eod-derived-metrics";
import { getCryptoLogoUrl, type SupportedCryptoSymbol } from "@/lib/crypto/crypto-logo-url";

export type CryptoAssetRow = {
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

function findMeta(symbol: SupportedCryptoTicker) {
  return CRYPTO_TOP10.find((m) => m.symbol === symbol) ?? null;
}

async function loadCryptoAssetUncached(symbolOrTicker: string): Promise<CryptoAssetRow | null> {
  const supported = toSupportedCryptoTicker(symbolOrTicker);
  if (!supported) return null;
  const meta = findMeta(supported);
  if (!meta) return null;

  const window = eodFetchWindowUtc();
  const logoUrl = getCryptoLogoUrl(supported as unknown as SupportedCryptoSymbol);
  // TON fallback: try Toncoin symbol first; if it fails, try the alternate.
  const tonCandidates =
    meta.symbol === "TON" && meta.eodhdAltSymbols?.length ? [meta.eodhdSymbol, ...meta.eodhdAltSymbols] : [meta.eodhdSymbol];

  if (meta.symbol === "TON") {
    // Required debugging: only TON row.
    console.log("[crypto asset TON candidates]", { candidates: tonCandidates, symbol: meta.symbol });
  }

  for (const candidateSymbol of tonCandidates) {
    const [bars, highlights] = await Promise.allSettled([
      fetchEodhdCryptoDailyBars(candidateSymbol, window.from, window.to),
      fetchEodhdCryptoFundamentalsHighlights(candidateSymbol),
    ]);

    const dailyBars: EodhdDailyBar[] | null = bars.status === "fulfilled" ? bars.value : null;
    const lastBar = dailyBars && dailyBars.length ? dailyBars[dailyBars.length - 1]! : null;
    const prevBar = dailyBars && dailyBars.length >= 2 ? dailyBars[dailyBars.length - 2]! : null;

    const currentPrice = lastBar?.close ?? null;
    const change1D = changePercent(currentPrice, prevBar?.close ?? null);
    const derived = dailyBars ? deriveMetricsFromDailyBars(dailyBars, currentPrice ?? NaN) : null;

    const marketCapUsd = highlights.status === "fulfilled" ? highlights.value?.marketCapUsd ?? null : null;
    const marketCapRaw = formatMarketCapDisplay(marketCapUsd);
    const marketCap = marketCapRaw.startsWith("$") ? marketCapRaw.slice(1) : marketCapRaw;

    const hasPrice = currentPrice != null && Number.isFinite(currentPrice);
    const hasMarketCap = marketCapUsd != null && Number.isFinite(marketCapUsd) && marketCapUsd > 0;

    // Prefer a fully populated result for TON; otherwise return the first with price.
    if (hasPrice && hasMarketCap) {
      return {
        symbol: meta.symbol,
        name: meta.name,
        price: currentPrice,
        changePercent1D: change1D,
        changePercent1M: derived?.changePercent1M ?? null,
        changePercentYTD: derived?.changePercentYTD ?? null,
        marketCap,
        sparkline5d: derived?.sparkline5d ?? [],
        logoUrl,
      };
    }
    if (hasPrice) {
      return {
        symbol: meta.symbol,
        name: meta.name,
        price: currentPrice,
        changePercent1D: change1D,
        changePercent1M: derived?.changePercent1M ?? null,
        changePercentYTD: derived?.changePercentYTD ?? null,
        marketCap,
        sparkline5d: derived?.sparkline5d ?? [],
        logoUrl,
      };
    }
  }

  return null;
}

export const getCryptoAsset = unstable_cache(loadCryptoAssetUncached, ["crypto-asset-v2"], {
  revalidate: 60,
});

