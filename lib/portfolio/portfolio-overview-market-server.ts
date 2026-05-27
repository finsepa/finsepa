import "server-only";

import { unstable_cache } from "next/cache";

import { REVALIDATE_HOT } from "@/lib/data/cache-policy";
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

async function stockSymbolOverview(
  ticker: string,
  fundamentalsByTicker: Map<string, Record<string, unknown> | null>,
): Promise<{ perf: StockPerformance | null; yieldPct: number | null }> {
  const perf = await getStockPerformance(ticker);
  const root = fundamentalsByTicker.get(ticker) ?? null;
  const yieldPct = root ? yieldPctFromRatio(dividendYieldRatioFromFundamentalsRoot(root)) : null;
  return { perf, yieldPct };
}

async function buildOverviewMarketPayloadUncached(
  symbols: string[],
  inceptionYmd: string | null,
  inceptionPriceTickers: string[],
): Promise<PortfolioOverviewMarketPayload> {
  const tickersPerf = [...new Set([SPY, ...symbols])];
  const fundamentalsByTicker = new Map<string, Record<string, unknown> | null>();

  const stockSymbolsForFundamentals = symbols.filter(
    (t) => !isSupportedCryptoAssetSymbol(cryptoRouteBase(t)),
  );
  await Promise.all(
    stockSymbolsForFundamentals.map(async (t) => {
      const root = await fetchEodhdFundamentalsJson(t);
      fundamentalsByTicker.set(t, root);
    }),
  );

  const perfEntries = await Promise.all(
    tickersPerf.map(async (t) => {
      try {
        const routeKey = cryptoRouteBase(t);
        if (isSupportedCryptoAssetSymbol(routeKey)) {
          const p = await getCryptoPerformance(routeKey);
          return [t, p, null] as const;
        }
        if (t === SPY && !symbols.includes(SPY)) {
          const p = await getStockPerformance(t);
          return [t, p, null] as const;
        }
        const { perf, yieldPct } = await stockSymbolOverview(t, fundamentalsByTicker);
        return [t, perf, yieldPct] as const;
      } catch {
        return [t, null, null] as const;
      }
    }),
  );

  const performanceBySymbol: Record<string, StockPerformance | null> = {};
  const yieldBySymbol: Record<string, number | null> = {};
  let spyPerf: StockPerformance | null = null;

  for (const [t, p, yld] of perfEntries) {
    if (t === SPY) spyPerf = p;
    if (symbols.includes(t)) {
      performanceBySymbol[t] = p;
      if (yld != null) yieldBySymbol[t] = yld;
    }
  }
  for (const s of symbols) {
    if (!(s in performanceBySymbol)) performanceBySymbol[s] = null;
    if (!(s in yieldBySymbol)) yieldBySymbol[s] = null;
  }

  const inceptionPriceByTicker: Record<string, number | null> = {};
  if (inceptionYmd && inceptionPriceTickers.length > 0) {
    const priceEntries = await Promise.all(
      inceptionPriceTickers.map(async (t) => {
        try {
          const routeKey = cryptoRouteBase(t);
          if (isSupportedCryptoAssetSymbol(routeKey)) {
            const r = await fetchEodhdCryptoOpenPriceOnOrBefore(routeKey, inceptionYmd);
            return [t, r?.price ?? null] as const;
          }
          const r = await fetchEodhdOpenPriceOnOrBefore(t, inceptionYmd);
          return [t, r?.price ?? null] as const;
        } catch {
          return [t, null] as const;
        }
      }),
    );
    for (const [t, price] of priceEntries) {
      inceptionPriceByTicker[t] = price;
    }
  }

  return {
    spy: spyPerf,
    performanceBySymbol,
    yieldBySymbol,
    inceptionPriceByTicker,
    inceptionYmd,
  };
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

const getCachedOverviewMarketPayload = unstable_cache(
  async (key: string, symbolsJson: string, inceptionYmd: string, inceptionTickersJson: string) => {
    const symbols = JSON.parse(symbolsJson) as string[];
    const inceptionPriceTickers = JSON.parse(inceptionTickersJson) as string[];
    const inc = inceptionYmd || null;
    return buildOverviewMarketPayloadUncached(symbols, inc, inceptionPriceTickers);
  },
  ["portfolio-overview-market-v2-shared-fundamentals"],
  { revalidate: REVALIDATE_HOT },
);

export async function getPortfolioOverviewMarketPayload(
  symbols: string[],
  inceptionYmd: string | null,
  inceptionPriceTickers: string[],
): Promise<PortfolioOverviewMarketPayload> {
  const key = overviewCacheKey(symbols, inceptionYmd, inceptionPriceTickers);
  return getCachedOverviewMarketPayload(
    key,
    JSON.stringify(symbols),
    inceptionYmd ?? "",
    JSON.stringify(inceptionPriceTickers),
  );
}
