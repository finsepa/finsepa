import "server-only";

import { fetchEodhdFundamentalsJson, fetchEodhdFundamentalsJsonFresh } from "@/lib/market/eodhd-fundamentals";
import { fetchEodhdKeyStatsAssetsLiabilities } from "@/lib/market/eodhd-key-stats-assets-liabilities";
import { fetchEodhdKeyStatsBasic } from "@/lib/market/eodhd-key-stats-basic";
import { fetchEodhdKeyStatsDividends } from "@/lib/market/eodhd-key-stats-dividends";
import { fetchEodhdKeyStatsGrowth } from "@/lib/market/eodhd-key-stats-growth";
import { fetchEodhdKeyStatsMargins } from "@/lib/market/eodhd-key-stats-margins";
import { fetchEodhdKeyStatsReturns } from "@/lib/market/eodhd-key-stats-returns";
import { fetchEodhdKeyStatsRevenueProfit } from "@/lib/market/eodhd-key-stats-revenue-profit";
import { fetchEodhdKeyStatsRisk } from "@/lib/market/eodhd-key-stats-risk";
import { fetchEodhdKeyStatsValuation } from "@/lib/market/eodhd-key-stats-valuation";
import type { StockKeyStatsBundle } from "@/lib/market/stock-key-stats-bundle-types";

const EMPTY_BUNDLE: StockKeyStatsBundle = {
  basic: null,
  valuation: null,
  revenueProfit: null,
  margins: null,
  growth: null,
  assetsLiabilities: null,
  returns: null,
  dividends: null,
  risk: null,
};

export async function buildStockKeyStatsBundle(
  ticker: string,
  opts?: { refreshFundamentals?: boolean },
): Promise<StockKeyStatsBundle> {
  const root = opts?.refreshFundamentals
    ? await fetchEodhdFundamentalsJsonFresh(ticker)
    : await fetchEodhdFundamentalsJson(ticker);
  if (!root) return { ...EMPTY_BUNDLE };

  const [
    basic,
    valuation,
    revenueProfit,
    margins,
    growth,
    assetsLiabilities,
    returns,
    dividends,
    risk,
  ] = await Promise.all([
    fetchEodhdKeyStatsBasic(ticker, root),
    fetchEodhdKeyStatsValuation(ticker, root),
    fetchEodhdKeyStatsRevenueProfit(ticker, root),
    fetchEodhdKeyStatsMargins(ticker, root),
    fetchEodhdKeyStatsGrowth(ticker, root),
    fetchEodhdKeyStatsAssetsLiabilities(ticker, root),
    fetchEodhdKeyStatsReturns(ticker, root),
    fetchEodhdKeyStatsDividends(ticker, root),
    fetchEodhdKeyStatsRisk(ticker, root),
  ]);

  return {
    basic: basic?.rows ?? null,
    valuation: valuation?.rows ?? null,
    revenueProfit: revenueProfit?.rows ?? null,
    margins: margins?.rows ?? null,
    growth: growth?.rows ?? null,
    assetsLiabilities: assetsLiabilities?.rows ?? null,
    returns: returns?.rows ?? null,
    dividends: dividends?.rows ?? null,
    risk: risk?.rows ?? null,
  };
}
