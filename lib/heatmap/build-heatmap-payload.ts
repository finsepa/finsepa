import "server-only";

import { unstable_cache } from "next/cache";

import { CRYPTO_SCREENER_ALL } from "@/lib/market/crypto-meta";
import { REVALIDATE_TIER_SCREENER_MARKET, REVALIDATE_TIER_STATIC } from "@/lib/data/cache-policy";
import {
  getSimpleCryptoDerived,
  getSimpleMarketDataCryptoScreenerPage2,
  getSimpleMarketDataCryptoTab,
  getSimpleMarketDataScreenerStocksAllPages,
  getSimpleScreenerDerived,
  type SimpleMarketData,
} from "@/lib/market/simple-market-layer";
import { REDUCED_CRYPTO } from "@/lib/market/reduced-universe";
import { cryptoScreenerRowsFromMetas } from "@/lib/screener/simple-screener-crypto-indices-rows";
import { getScreenerCompaniesStaticLayer } from "@/lib/screener/screener-companies-layers";
import { mapProviderSectorToCanonical } from "@/lib/screener/screener-gics-sectors";
import { isTop10Ticker, type Top10Ticker } from "@/lib/screener/top10-config";
import type { HeatmapLeaf, HeatmapMarket, HeatmapMetric, HeatmapPagePayload } from "@/lib/heatmap/heatmap-types";

function parseHeatmapMarket(raw: string | undefined): HeatmapMarket {
  if (raw?.toLowerCase() === "crypto") return "crypto";
  return "stocks";
}

function parseHeatmapMetric(raw: string | undefined): HeatmapMetric {
  const k = raw?.toLowerCase();
  if (k === "5d" || k === "1w") return "5d";
  if (k === "1m") return "1m";
  if (k === "ytd") return "ytd";
  return "1d";
}

export function heatmapMarketFromSearchParam(raw: string | string[] | undefined): HeatmapMarket {
  const v = Array.isArray(raw) ? raw[0] : raw;
  return parseHeatmapMarket(v?.trim());
}

export function heatmapMetricFromSearchParam(raw: string | string[] | undefined): HeatmapMetric {
  const v = Array.isArray(raw) ? raw[0] : raw;
  return parseHeatmapMetric(v?.trim());
}

function sparklineForStock(
  ticker: string,
  tk: string,
  u: { closes5d: number[] | null },
  derivedTop10: Record<Top10Ticker, { last5DailyCloses: number[] }>,
  derivedPage2: Record<string, { last5DailyCloses: number[] }>,
): number[] {
  if (isTop10Ticker(ticker)) {
    const s = derivedTop10[ticker]?.last5DailyCloses;
    if (s?.length) return s.slice(-5);
  }
  const p2 = derivedPage2[tk]?.last5DailyCloses;
  if (p2?.length) return p2.slice(-5);
  const c = u.closes5d;
  return c?.length ? c.slice(-5) : [];
}

function stockChangeForMetric(
  ticker: string,
  u: { refund1dP: number | null; refund5dP: number | null; refund1mP: number | null; refundYtdP: number | null },
  metric: HeatmapMetric,
  data: SimpleMarketData,
  derivedTop10: Record<Top10Ticker, { changePercent1M: number | null; changePercentYTD: number | null }>,
  derivedPage2: Record<string, { changePercent1M: number | null; changePercentYTD: number | null }>,
): number | null {
  const tk = ticker.trim().toUpperCase();
  const qTop = isTop10Ticker(ticker) ? data.stocks[ticker] : undefined;
  const qExtra = data.extraScreenerStocks[tk] ?? data.extraScreenerStocks[ticker] ?? undefined;

  if (metric === "1d") {
    return qTop?.changePercent1D ?? qExtra?.changePercent1D ?? u.refund1dP;
  }
  if (metric === "5d") {
    return u.refund5dP;
  }
  if (metric === "1m") {
    const d = isTop10Ticker(ticker) ? derivedTop10[ticker] : derivedPage2[tk];
    return d?.changePercent1M ?? u.refund1mP;
  }
  const d = isTop10Ticker(ticker) ? derivedTop10[ticker] : derivedPage2[tk];
  return d?.changePercentYTD ?? u.refundYtdP;
}

type HeatmapBaseLeaf = Pick<HeatmapLeaf, "id" | "ticker" | "name" | "sector" | "industry" | "marketCapUsd">;

async function buildStocksBaseLeavesUncached(): Promise<HeatmapBaseLeaf[]> {
  const { universe } = await getScreenerCompaniesStaticLayer();
  const out: HeatmapBaseLeaf[] = [];
  for (const u of universe) {
    if (u.marketCapUsd <= 0 || !Number.isFinite(u.marketCapUsd)) continue;
    const canon = mapProviderSectorToCanonical(u.sector);
    const sector = canon ?? "Unclassified";
    const rawInd = u.industry?.trim() ?? "";
    const industry = rawInd.length > 0 ? rawInd : "Unclassified";
    const tk = u.ticker.trim().toUpperCase();
    if (!tk) continue;
    out.push({
      id: `s-${tk}`,
      ticker: tk,
      name: u.name,
      sector,
      industry,
      marketCapUsd: u.marketCapUsd,
    });
  }
  return out;
}

const getStocksBaseLeaves = unstable_cache(buildStocksBaseLeavesUncached, ["heatmap-stocks-base-leaves-v1"], {
  revalidate: REVALIDATE_TIER_STATIC,
});

async function buildStocksOverlayUncached(metric: HeatmapMetric) {
  const [staticLayer, data, derived] = await Promise.all([
    getScreenerCompaniesStaticLayer(),
    getSimpleMarketDataScreenerStocksAllPages(),
    getSimpleScreenerDerived(),
  ]);

  // Uppercase ticker → overlay slice (price/change/sparkline).
  const out = new Map<string, Pick<HeatmapLeaf, "price" | "changePct" | "sparkline5d">>();
  for (const u of staticLayer.universe) {
    const tRaw = u.ticker?.trim() ?? "";
    if (!tRaw) continue;
    const tk = tRaw.toUpperCase();
    const qTop = isTop10Ticker(tRaw) ? data.stocks[tRaw] : undefined;
    const qExtra = data.extraScreenerStocks[tk] ?? data.extraScreenerStocks[tRaw] ?? undefined;
    const price = qTop?.price ?? qExtra?.price ?? u.adjustedClose;
    const changePct = stockChangeForMetric(tRaw, u, metric, data, derived.top10, derived.page2);
    const sparkline5d = sparklineForStock(tRaw, tk, u, derived.top10, derived.page2);
    out.set(tk, {
      price: price != null && Number.isFinite(price) && price > 0 ? price : null,
      changePct,
      sparkline5d,
    });
  }
  return out;
}

const getStocksOverlay = unstable_cache(buildStocksOverlayUncached, ["heatmap-stocks-overlay-v1"], {
  revalidate: REVALIDATE_TIER_SCREENER_MARKET,
});

async function buildStocksLeaves(metric: HeatmapMetric): Promise<HeatmapLeaf[]> {
  const [base, overlay] = await Promise.all([getStocksBaseLeaves(), getStocksOverlay(metric)]);
  return base.map((b) => {
    const o = overlay.get(b.ticker);
    return {
      ...b,
      changePct: o?.changePct ?? null,
      price: o?.price ?? null,
      sparkline5d: o?.sparkline5d ?? [],
    };
  });
}

async function buildCryptoBaseLeavesUncached(): Promise<HeatmapBaseLeaf[]> {
  const sector = "Cryptocurrencies";
  const industry = "Cryptocurrencies";
  return CRYPTO_SCREENER_ALL.map((m) => {
    const sym = m.symbol.toUpperCase();
    const fallback = REDUCED_CRYPTO[sym]?.marketCapUsd;
    const marketCapUsd = fallback != null && Number.isFinite(fallback) && fallback > 0 ? fallback : 1;
    return {
      id: `c-${sym}`,
      ticker: sym,
      name: m.name,
      sector,
      industry,
      marketCapUsd,
    } satisfies HeatmapBaseLeaf;
  });
}

const getCryptoBaseLeaves = unstable_cache(buildCryptoBaseLeavesUncached, ["heatmap-crypto-base-leaves-v1"], {
  revalidate: REVALIDATE_TIER_STATIC,
});

async function buildCryptoLeaves(metric: HeatmapMetric): Promise<HeatmapLeaf[]> {
  const [base, tabData, p2Data, derived] = await Promise.all([
    getCryptoBaseLeaves(),
    getSimpleMarketDataCryptoTab(),
    getSimpleMarketDataCryptoScreenerPage2(),
    getSimpleCryptoDerived(),
  ]);

  const data: SimpleMarketData = {
    ...tabData,
    crypto: { ...tabData.crypto, ...p2Data.crypto },
  };

  const rows = cryptoScreenerRowsFromMetas(CRYPTO_SCREENER_ALL, data, derived);
  const bySym = new Map(rows.map((r) => [r.symbol.toUpperCase(), r] as const));

  return base.map((b) => {
    const r = bySym.get(b.ticker);
    const d = derived[b.ticker] ?? derived[b.ticker.toLowerCase()] ?? null;
    let changePct: number | null = null;
    if (metric === "1d") changePct = r?.changePercent1D ?? null;
    else if (metric === "5d") changePct = d?.changePercent7D ?? null;
    else if (metric === "1m") changePct = r?.changePercent1M ?? null;
    else changePct = r?.changePercentYTD ?? null;

    const mcap = d?.marketCapUsd;
    const marketCapUsd = mcap != null && Number.isFinite(mcap) && mcap > 0 ? mcap : b.marketCapUsd;

    const sparkFromRow = r?.sparkline5d?.length ? r.sparkline5d : [];
    const sparkFromDerived = d?.last5DailyCloses?.length ? d.last5DailyCloses.slice(-5) : [];
    const sparkline5d = sparkFromRow.length ? sparkFromRow.slice(-5) : sparkFromDerived;

    return {
      ...b,
      marketCapUsd,
      changePct,
      price: r?.price != null && Number.isFinite(r.price) && r.price > 0 ? r.price : null,
      sparkline5d,
    } satisfies HeatmapLeaf;
  });
}

async function buildHeatmapPagePayloadUncached(market: HeatmapMarket, metric: HeatmapMetric): Promise<HeatmapPagePayload> {
  const leaves = market === "crypto" ? await buildCryptoLeaves(metric) : await buildStocksLeaves(metric);
  return { market, metric, leaves };
}

/**
 * Heatmaps are identical for all users; cache the assembled payload to avoid
 * re-running the universe mapping loop + crypto derived fan-out per request.
 */
export const buildHeatmapPagePayload = unstable_cache(
  buildHeatmapPagePayloadUncached,
  ["heatmap-page-payload-v2"],
  { revalidate: REVALIDATE_TIER_SCREENER_MARKET },
);
