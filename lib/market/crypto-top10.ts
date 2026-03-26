import "server-only";

import { unstable_cache } from "next/cache";

import { CRYPTO_TOP10, type SupportedCryptoTicker, fetchEodhdCryptoDailyBars, fetchEodhdCryptoFundamentalsHighlights } from "@/lib/market/eodhd-crypto";
import { getCryptoLogoUrl, type SupportedCryptoSymbol } from "@/lib/crypto/crypto-logo-url";
import { deriveMetricsFromDailyBars, eodFetchWindowUtc, formatMarketCapDisplay } from "@/lib/screener/eod-derived-metrics";
import type { EodhdDailyBar } from "@/lib/market/eodhd-eod";

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
  const logoUrl = getCryptoLogoUrl(meta.symbol as SupportedCryptoSymbol);

  // TON fallback: try Toncoin symbol first; if it fails, try the alternate.
  // This preserves the UI while avoiding broken/incorrect values for only the TON row.
  const tonCandidates =
    meta.symbol === "TON" && meta.eodhdAltSymbols?.length
      ? [meta.eodhdSymbol, ...meta.eodhdAltSymbols]
      : [meta.eodhdSymbol];

  let best:
    | {
        dailyBars: EodhdDailyBar[] | null;
        currentPrice: number | null;
        change1D: number | null;
        derived: ReturnType<typeof deriveMetricsFromDailyBars> | null;
        marketCapUsd: number | null;
      }
    | null = null;

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
    const marketCapUsd =
      highlights.status === "fulfilled" ? highlights.value?.marketCapUsd ?? null : null;

    // Choose the first candidate that has price + market cap; if not possible, keep the best with price.
    const hasPrice = currentPrice != null && Number.isFinite(currentPrice);
    const hasMarketCap = marketCapUsd != null && Number.isFinite(marketCapUsd) && marketCapUsd > 0;

    if (hasPrice && hasMarketCap) {
      best = { dailyBars, currentPrice, change1D, derived, marketCapUsd };
      break;
    }
    if (hasPrice && !best) {
      best = { dailyBars, currentPrice, change1D, derived, marketCapUsd };
    }
  }

  const currentPrice = best?.currentPrice ?? null;
  const change1D = best?.change1D ?? null;
  const sparkline5d = best?.derived?.sparkline5d ?? [];
  const change1M = best?.derived?.changePercent1M ?? null;
  const changeYTD = best?.derived?.changePercentYTD ?? null;

  const marketCapUsd = best?.marketCapUsd ?? null;
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

export const getCryptoTop10 = unstable_cache(loadCryptoTop10Uncached, ["crypto-top10-v2"], {
  revalidate: 60,
});

