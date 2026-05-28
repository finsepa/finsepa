import "server-only";

import { unstable_cache } from "next/cache";

import { REVALIDATE_HOT, REVALIDATE_IDENTITY } from "@/lib/data/cache-policy";
import { cryptoRouteBase } from "@/lib/crypto/crypto-symbol-base";
import { isSupportedCryptoAssetSymbol } from "@/lib/crypto/crypto-logo-url";
import { fetchEodhdCryptoOpenPriceOnOrBefore } from "@/lib/market/eodhd-crypto";
import { fetchEodhdOpenPriceOnOrBefore } from "@/lib/market/eodhd-eod";
import { fetchEodhdFundamentalsJson } from "@/lib/market/eodhd-fundamentals";
import { dividendYieldRatioFromFundamentalsRoot } from "@/lib/market/eodhd-key-stats-dividends";
import { getCryptoPerformance } from "@/lib/market/crypto-performance";
import { getStockPerformance } from "@/lib/market/stock-performance";
import type { StockPerformance } from "@/lib/market/stock-performance-types";

const SPY = "SPY";

export type PortfolioOverviewMarketPayload = {
  spy: StockPerformance | null;
  performanceBySymbol: Record<string, StockPerformance | null>;
  yieldBySymbol: Record<string, number | null>;
  inceptionPriceByTicker: Record<string, number | null>;
  inceptionYmd: string | null;
};

function yieldPctFromRatio(ratio: number | null): number | null {
  if (ratio == null || !Number.isFinite(ratio)) return null;
  return ratio * 100;
}

async function yieldPctForStockSymbolUncached(ticker: string): Promise<number | null> {
  const root = await fetchEodhdFundamentalsJson(ticker);
  if (!root) return null;
  return yieldPctFromRatio(dividendYieldRatioFromFundamentalsRoot(root));
}

const getCachedYieldPctForStockSymbol = unstable_cache(
  async (ticker: string) => yieldPctForStockSymbolUncached(ticker),
  ["portfolio-overview-yield-v1"],
  { revalidate: REVALIDATE_IDENTITY },
);

const getCachedInceptionOpenPrice = unstable_cache(
  async (ticker: string, inceptionYmd: string) => {
    const routeKey = cryptoRouteBase(ticker);
    if (isSupportedCryptoAssetSymbol(routeKey)) {
      const r = await fetchEodhdCryptoOpenPriceOnOrBefore(routeKey, inceptionYmd);
      return r?.price ?? null;
    }
    const r = await fetchEodhdOpenPriceOnOrBefore(ticker, inceptionYmd);
    return r?.price ?? null;
  },
  ["portfolio-overview-inception-open-v1"],
  { revalidate: REVALIDATE_IDENTITY },
);

async function buildOverviewFastUncached(symbols: string[]): Promise<Pick<PortfolioOverviewMarketPayload, "spy" | "performanceBySymbol">> {
  const tickersPerf = [...new Set([SPY, ...symbols])];
  const perfEntries = await Promise.all(
    tickersPerf.map(async (t) => {
      try {
        const routeKey = cryptoRouteBase(t);
        if (isSupportedCryptoAssetSymbol(routeKey)) {
          const p = await getCryptoPerformance(routeKey);
          return [t, p] as const;
        }
        const p = await getStockPerformance(t);
        return [t, p] as const;
      } catch {
        return [t, null] as const;
      }
    }),
  );

  const performanceBySymbol: Record<string, StockPerformance | null> = {};
  let spyPerf: StockPerformance | null = null;
  for (const [t, p] of perfEntries) {
    if (t === SPY) spyPerf = p;
    if (symbols.includes(t)) performanceBySymbol[t] = p;
  }
  for (const s of symbols) {
    if (!(s in performanceBySymbol)) performanceBySymbol[s] = null;
  }
  return { spy: spyPerf, performanceBySymbol };
}

async function buildOverviewSlowUncached(
  symbols: string[],
  inceptionYmd: string | null,
  inceptionPriceTickers: string[],
): Promise<Pick<PortfolioOverviewMarketPayload, "yieldBySymbol" | "inceptionPriceByTicker" | "inceptionYmd">> {
  const yieldBySymbol: Record<string, number | null> = {};
  const stockSymbolsForYield = symbols.filter((t) => !isSupportedCryptoAssetSymbol(cryptoRouteBase(t)));
  const yieldEntries = await Promise.all(
    stockSymbolsForYield.map(async (t) => {
      try {
        const y = await getCachedYieldPctForStockSymbol(t);
        return [t, y] as const;
      } catch {
        return [t, null] as const;
      }
    }),
  );
  for (const [t, y] of yieldEntries) yieldBySymbol[t] = y;
  for (const s of symbols) {
    if (!(s in yieldBySymbol)) yieldBySymbol[s] = null;
  }

  const inceptionPriceByTicker: Record<string, number | null> = {};
  if (inceptionYmd && inceptionPriceTickers.length > 0) {
    const priceEntries = await Promise.all(
      inceptionPriceTickers.map(async (t) => {
        try {
          const p = await getCachedInceptionOpenPrice(t, inceptionYmd);
          return [t, p] as const;
        } catch {
          return [t, null] as const;
        }
      }),
    );
    for (const [t, price] of priceEntries) inceptionPriceByTicker[t] = price;
  }

  return { yieldBySymbol, inceptionPriceByTicker, inceptionYmd };
}

function overviewCacheKey(
  symbols: string[],
  inceptionYmd: string | null,
  inceptionPriceTickers: string[],
): string {
  const syms = [...symbols].sort().join(",");
  const inc = inceptionYmd ?? "";
  const incTk = [...inceptionPriceTickers].sort().join(",");
  return `${syms}|${inc}|${incTk}`;
}

const getCachedOverviewFast = unstable_cache(
  async (symbolsJson: string) => {
    const symbols = JSON.parse(symbolsJson) as string[];
    return buildOverviewFastUncached(symbols);
  },
  ["portfolio-overview-market-fast-v1"],
  { revalidate: REVALIDATE_HOT },
);

const getCachedOverviewSlow = unstable_cache(
  async (key: string, symbolsJson: string, inceptionYmd: string, inceptionTickersJson: string) => {
    const symbols = JSON.parse(symbolsJson) as string[];
    const inceptionPriceTickers = JSON.parse(inceptionTickersJson) as string[];
    const inc = inceptionYmd || null;
    return buildOverviewSlowUncached(symbols, inc, inceptionPriceTickers);
  },
  ["portfolio-overview-market-slow-v1"],
  { revalidate: REVALIDATE_IDENTITY },
);

export async function getPortfolioOverviewMarketPayload(
  symbols: string[],
  inceptionYmd: string | null,
  inceptionPriceTickers: string[],
): Promise<PortfolioOverviewMarketPayload> {
  const key = overviewCacheKey(symbols, inceptionYmd, inceptionPriceTickers);
  const symbolsJson = JSON.stringify(symbols);
  const tickersJson = JSON.stringify(inceptionPriceTickers);
  const [fast, slow] = await Promise.all([
    getCachedOverviewFast(symbolsJson),
    getCachedOverviewSlow(key, symbolsJson, inceptionYmd ?? "", tickersJson),
  ]);
  return {
    spy: fast.spy,
    performanceBySymbol: fast.performanceBySymbol,
    yieldBySymbol: slow.yieldBySymbol,
    inceptionPriceByTicker: slow.inceptionPriceByTicker,
    inceptionYmd: slow.inceptionYmd,
  };
}
