import "server-only";

import { unstable_cache } from "next/cache";

import { REVALIDATE_HOT } from "@/lib/data/cache-policy";
import { type SupportedCryptoTicker, fetchEodhdCryptoDailyBars } from "@/lib/market/eodhd-crypto";
import { resolveCryptoMetaForProvider } from "@/lib/market/crypto-meta-resolver";
import type { CryptoFundamentalsMeta } from "@/lib/market/eodhd-crypto-fundamentals-meta";
import { fetchEodhdCryptoFundamentalsMeta } from "@/lib/market/eodhd-crypto-fundamentals-meta";
import type { EodhdDailyBar } from "@/lib/market/eodhd-eod";
import { deriveMetricsFromDailyBars, eodFetchWindowUtc, formatMarketCapDisplay } from "@/lib/screener/eod-derived-metrics";
import { getCryptoLogoUrl } from "@/lib/crypto/crypto-logo-url";

export type CryptoAssetLinks = {
  website: string | null;
  whitepaper: string | null;
  github: string | null;
  twitter: string | null;
  reddit: string | null;
  telegram: string | null;
  discord: string | null;
  explorers: string[];
  wallets: string[];
};

export type CryptoAssetRow = {
  symbol: SupportedCryptoTicker;
  name: string;
  price: number | null;
  changePercent1D: number | null;
  changePercent1M: number | null;
  changePercentYTD: number | null;
  marketCap: string;
  fullyDilutedMarketCap: string;
  athMarketCap: string;
  totalSupply: string;
  circulatingSupply: string;
  maxSupply: string;
  volume24h: string;
  volumeToMarketCap24h: string;
  sparkline5d: number[];
  logoUrl: string;
  links: CryptoAssetLinks;
};

function changePercent(current: number | null, prev: number | null): number | null {
  if (current == null || prev == null) return null;
  if (!Number.isFinite(current) || !Number.isFinite(prev) || prev === 0) return null;
  return ((current - prev) / prev) * 100;
}

function fmtUsdDisplay(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return "-";
  const raw = formatMarketCapDisplay(n);
  if (raw === "-") return "-";
  return raw.startsWith("$") ? raw.slice(1) : raw;
}

function fmtSupplyDisplay(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return "-";
  return n.toLocaleString("en-US", { maximumFractionDigits: 8 });
}

function fmtRatioDisplay(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return "-";
  return `${(n * 100).toFixed(1)}%`;
}

function mapLinks(fund: CryptoFundamentalsMeta | null): CryptoAssetLinks {
  if (!fund) {
    return {
      website: null,
      whitepaper: null,
      github: null,
      twitter: null,
      reddit: null,
      telegram: null,
      discord: null,
      explorers: [],
      wallets: [],
    };
  }
  return {
    website: fund.website,
    whitepaper: fund.whitepaper,
    github: fund.github,
    twitter: fund.twitter,
    reddit: fund.reddit,
    telegram: fund.telegram,
    discord: fund.discord,
    explorers: fund.explorers,
    wallets: fund.wallets,
  };
}

function mapFundamentals(fund: CryptoFundamentalsMeta | null): Pick<
  CryptoAssetRow,
  | "fullyDilutedMarketCap"
  | "athMarketCap"
  | "totalSupply"
  | "circulatingSupply"
  | "maxSupply"
  | "volume24h"
  | "volumeToMarketCap24h"
  | "links"
> {
  return {
    fullyDilutedMarketCap: fmtUsdDisplay(fund?.fullyDilutedMarketCapUsd ?? null),
    athMarketCap: fmtUsdDisplay(fund?.athMarketCapUsd ?? null),
    totalSupply: fmtSupplyDisplay(fund?.totalSupply ?? null),
    circulatingSupply: fmtSupplyDisplay(fund?.circulatingSupply ?? null),
    maxSupply: fmtSupplyDisplay(fund?.maxSupply ?? null),
    volume24h: fmtUsdDisplay(fund?.volume24hUsd ?? null),
    volumeToMarketCap24h: fmtRatioDisplay(fund?.volumeToMarketCap24h ?? null),
    links: mapLinks(fund),
  };
}

async function loadCryptoAssetUncached(symbolOrTicker: string): Promise<CryptoAssetRow | null> {
  const meta = await resolveCryptoMetaForProvider(symbolOrTicker);
  if (!meta) return null;

  const window = eodFetchWindowUtc();
  const logoUrl = getCryptoLogoUrl(meta.symbol);
  const tonCandidates =
    meta.symbol === "TON" && meta.eodhdAltSymbols?.length ? [meta.eodhdSymbol, ...meta.eodhdAltSymbols] : [meta.eodhdSymbol];

  for (const candidateSymbol of tonCandidates) {
    const [bars, fundResult] = await Promise.allSettled([
      fetchEodhdCryptoDailyBars(candidateSymbol, window.from, window.to),
      fetchEodhdCryptoFundamentalsMeta(candidateSymbol),
    ]);

    const dailyBars: EodhdDailyBar[] | null = bars.status === "fulfilled" ? bars.value : null;
    const lastBar = dailyBars && dailyBars.length ? dailyBars[dailyBars.length - 1]! : null;
    const prevBar = dailyBars && dailyBars.length >= 2 ? dailyBars[dailyBars.length - 2]! : null;

    const currentPrice = lastBar?.close ?? null;
    const change1D = changePercent(currentPrice, prevBar?.close ?? null);
    const derived = dailyBars ? deriveMetricsFromDailyBars(dailyBars, currentPrice ?? NaN) : null;

    const fund = fundResult.status === "fulfilled" ? fundResult.value : null;
    const marketCapUsd = fund?.marketCapUsd ?? null;
    const marketCapRaw = formatMarketCapDisplay(marketCapUsd);
    const marketCap = marketCapRaw.startsWith("$") ? marketCapRaw.slice(1) : marketCapRaw;

    const hasPrice = currentPrice != null && Number.isFinite(currentPrice);
    const hasMarketCap = marketCapUsd != null && Number.isFinite(marketCapUsd) && marketCapUsd > 0;

    const base = {
      symbol: meta.symbol,
      name: meta.name,
      price: currentPrice,
      changePercent1D: change1D,
      changePercent1M: derived?.changePercent1M ?? null,
      changePercentYTD: derived?.changePercentYTD ?? null,
      marketCap,
      sparkline5d: derived?.sparkline5d ?? [],
      logoUrl,
      ...mapFundamentals(fund),
    };

    if (hasPrice && hasMarketCap) {
      return base;
    }
    if (hasPrice) {
      return base;
    }
  }

  return null;
}

export const getCryptoAsset = unstable_cache(loadCryptoAssetUncached, ["crypto-asset-v6-cc-universe"], {
  revalidate: REVALIDATE_HOT,
});
