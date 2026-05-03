import "server-only";

import { unstable_cache } from "next/cache";

import { REVALIDATE_SCREENER_MARKET } from "@/lib/data/cache-policy";
import type { IndexCardData } from "@/lib/screener/indices-today";
import type { ScreenerTableRow } from "@/lib/screener/screener-static";
import type { CryptoTop10Row } from "@/lib/market/crypto-top10";
import type { IndexTableRow } from "@/lib/market/indices-top10";
import type { EodhdRealtimePayload } from "@/lib/market/eodhd-realtime";
import type { SimpleMarketData, SimpleMarketDatum, SimpleScreenerDerived } from "@/lib/market/simple-market-layer";
import type { TopCompanyUniverseRow } from "@/lib/screener/top500-companies";

import { buildScreenerCompanyRowFromUniverse, resolveScreenerPeToMatchKeyStats } from "@/lib/screener/companies-rows";
import { companyLogoUrlForTicker } from "@/lib/screener/company-logo-url";
import { getScreenerCompaniesStaticLayer } from "@/lib/screener/screener-companies-layers";
import { resolveEquityLogoUrlFromTicker } from "@/lib/screener/resolve-equity-logo-url";
import { CRYPTO_SCREENER_PAGE2, CRYPTO_TOP10 } from "@/lib/market/eodhd-crypto";
import { pickScreenerPage2Tickers } from "@/lib/screener/pick-screener-page2-tickers";
import { TOP10_META, TOP10_TICKERS, type Top10Ticker } from "@/lib/screener/top10-config";
import { formatUsdCompact } from "@/lib/market/key-stats-basic-format";
import { REDUCED_STOCKS } from "@/lib/market/reduced-universe";
import {
  getSimpleCryptoDerivedForMetas,
  getSimpleCryptoDerivedTop10,
  getSimpleIndicesDerived,
  getSimpleMarketDataCryptoScreenerPage2,
  getSimpleMarketDataCryptoTab,
  getSimpleMarketDataForScreenerPage2Slice,
  getSimpleMarketDataIndicesTab,
  getSimpleMarketDataScreenerStocks,
  getSimpleMarketDataScreenerStocksAllPages,
  getSimpleScreenerDerived,
  getSimpleScreenerDerivedTop10,
  getSimpleScreenerStockDerivedForTickers,
} from "@/lib/market/simple-market-layer";
import { getSimpleIndexCards } from "@/lib/screener/simple-index-cards";
import {
  cryptoScreenerRowsFromMetas,
  indicesTableRowsFromSimpleLayers,
} from "@/lib/screener/simple-screener-crypto-indices-rows";
import {
  filterAndSortUniverseByCanonicalSector,
  filterAndSortUniverseByIndustry,
} from "@/lib/screener/screener-companies-sector-filter";
import { getScreenerSectorEtfProxyYtdBySector } from "@/lib/screener/screener-sector-etf-ytd";
import { buildScreenerSectorsAndIndustriesRows } from "@/lib/screener/screener-stocks-universe-aggregates";
import type { ScreenerCanonicalSector } from "@/lib/screener/screener-gics-sectors";
import type { ScreenerIndustryDrill } from "@/lib/screener/screener-industry-url";
import type { ScreenerIndustryRow } from "@/lib/screener/screener-industries-types";
import type { ScreenerSectorRow } from "@/lib/screener/screener-sectors-types";
import { SCREENER_MARKETS_PAGE_SIZE } from "@/lib/screener/screener-markets-page-size";

export type ScreenerMarketTab = "stocks" | "crypto" | "indices";

export type ScreenerPagePayload =
  | {
      market: "stocks";
      stockRows: ScreenerTableRow[];
      stocksTotalCount: number;
      /** When set, Companies tab lists only names in this canonical sector (from the screener universe). */
      stocksSectorFilter: ScreenerCanonicalSector | null;
      /** When set, Industries tab drill lists names in this sector + industry (from the screener universe). */
      stocksIndustryFilter: ScreenerIndustryDrill | null;
      indexCards: IndexCardData[];
      sectors: ScreenerSectorRow[];
      industries: ScreenerIndustryRow[];
    }
  | { market: "crypto"; cryptoRows: CryptoTop10Row[]; cryptoTotalCount: number }
  | { market: "indices"; indicesRows: IndexTableRow[] };

function simpleDatumToRealtimePayload(d: SimpleMarketDatum | undefined): EodhdRealtimePayload | undefined {
  if (!d || d.price == null) return undefined;
  return {
    close: d.price,
    previousClose: d.previousClose ?? undefined,
    change_p: d.changePercent1D ?? undefined,
  };
}

function pickScreenerPct(snapshot: number | null | undefined, fromBars: number | null | undefined): number | null {
  if (snapshot != null && Number.isFinite(snapshot)) return snapshot;
  if (fromBars != null && Number.isFinite(fromBars)) return fromBars;
  return null;
}

/**
 * Companies table: 1M/YTD prefer EODHD screener snapshot (`refund1mP` / `refundYtdP`); when the API omits them,
 * fall back to {@link getSimpleScreenerDerived} (cached daily EOD bars — same source as sparkline metrics).
 */
export async function buildStockScreenerTablePages(
  data: SimpleMarketData,
  universe: TopCompanyUniverseRow[],
  derived: SimpleScreenerDerived,
): Promise<{ page1: ScreenerTableRow[]; page2: ScreenerTableRow[] }> {
  const byTicker = new Map(universe.map((u) => [u.ticker.toUpperCase(), u] as const));

  const peTop10 = await Promise.all(
    TOP10_TICKERS.map((t) => resolveScreenerPeToMatchKeyStats(t, byTicker.get(t))),
  );
  const peByTop10Ticker = new Map(TOP10_TICKERS.map((t, i) => [t, peTop10[i]!] as const));

  const page1Candidates = TOP10_TICKERS.map((ticker: Top10Ticker) => {
    const q = data.stocks[ticker];
    const meta = TOP10_META[ticker];
    const u = byTicker.get(ticker);
    const bar = derived.top10[ticker];
    const mcapFromUniverse = u?.marketCapUsd;
    const mcapUsd =
      mcapFromUniverse != null && Number.isFinite(mcapFromUniverse) && mcapFromUniverse > 0
        ? mcapFromUniverse
        : REDUCED_STOCKS[ticker].marketCapUsd;
    return {
      mcapUsd,
      row: {
        ticker,
        name: meta.name,
        logoUrl: companyLogoUrlForTicker(ticker, meta.domain),
        price: q?.price ?? null,
        change1D: q?.changePercent1D ?? null,
        change1M: pickScreenerPct(u?.refund1mP, bar?.changePercent1M),
        changeYTD: pickScreenerPct(u?.refundYtdP, bar?.changePercentYTD),
        marketCap: formatUsdCompact(mcapUsd),
        pe: peByTop10Ticker.get(ticker) ?? "—",
        trend: [] as ScreenerTableRow["trend"],
      } satisfies Omit<ScreenerTableRow, "id">,
    };
  });

  page1Candidates.sort((a, b) => {
    const d = b.mcapUsd - a.mcapUsd;
    if (d !== 0) return d;
    return a.row.ticker.localeCompare(b.row.ticker);
  });

  const page1: ScreenerTableRow[] = page1Candidates.map((c, i) => ({
    id: i + 1,
    ...c.row,
  }));

  const page2Logos = Object.fromEntries(
    data.screenerStocksPage2Tickers.map((t) => [t.toUpperCase(), resolveEquityLogoUrlFromTicker(t).trim()] as const),
  ) as Record<string, string>;

  const page2Pe = await Promise.all(
    data.screenerStocksPage2Tickers.map((t) => {
      const tk = t.toUpperCase();
      return resolveScreenerPeToMatchKeyStats(t, byTicker.get(tk));
    }),
  );

  const page2: ScreenerTableRow[] = [];
  let rankId = 11;
  for (let i = 0; i < data.screenerStocksPage2Tickers.length; i++) {
    const t = data.screenerStocksPage2Tickers[i]!;
    const tk = t.toUpperCase();
    const u = byTicker.get(tk);
    if (!u) continue;
    const ex = data.extraScreenerStocks[t] ?? data.extraScreenerStocks[tk];
    page2.push(
      buildScreenerCompanyRowFromUniverse(
        u,
        rankId++,
        simpleDatumToRealtimePayload(ex),
        page2Logos[tk] ?? "",
        derived.page2[tk] ?? null,
        page2Pe[i]!,
      ),
    );
  }

  return { page1, page2 };
}

/** Page-2-only rows for a ticker slice (pagination / on-demand). */
export async function buildScreenerPage2RowsForTickers(
  tickers: string[],
  universe: TopCompanyUniverseRow[],
  rankStart: number,
): Promise<ScreenerTableRow[]> {
  if (!tickers.length) return [];
  const data = await getSimpleMarketDataForScreenerPage2Slice(tickers);
  const derivedByUpper = await getSimpleScreenerStockDerivedForTickers(tickers, data);
  const page2Logos = Object.fromEntries(
    tickers.map((t) => [t.toUpperCase(), resolveEquityLogoUrlFromTicker(t).trim()] as const),
  ) as Record<string, string>;
  const byTicker = new Map(universe.map((u) => [u.ticker.toUpperCase(), u] as const));
  const p2Pe = await Promise.all(tickers.map((t) => resolveScreenerPeToMatchKeyStats(t, byTicker.get(t.toUpperCase()))));
  let rankId = rankStart;
  const rows: ScreenerTableRow[] = [];
  for (let i = 0; i < tickers.length; i++) {
    const t = tickers[i]!;
    const tk = t.toUpperCase();
    const u = byTicker.get(tk);
    if (!u) continue;
    const ex = data.extraScreenerStocks[t] ?? data.extraScreenerStocks[tk];
    rows.push(
      buildScreenerCompanyRowFromUniverse(
        u,
        rankId++,
        simpleDatumToRealtimePayload(ex),
        page2Logos[tk] ?? "",
        derivedByUpper[tk] ?? null,
        p2Pe[i]!,
      ),
    );
  }
  return rows;
}

export type ScreenerCompaniesApiQueryOpts = {
  sector?: ScreenerCanonicalSector | null;
  industry?: string | null;
  industrySector?: ScreenerCanonicalSector | null;
};

type ScreenerCompaniesListMode =
  | { mode: "all" }
  | { mode: "sector"; sector: ScreenerCanonicalSector }
  | { mode: "industry"; sector: ScreenerCanonicalSector; industry: string };

function resolveScreenerCompaniesListMode(opts?: ScreenerCompaniesApiQueryOpts): ScreenerCompaniesListMode {
  const o = opts ?? {};
  const industry = typeof o.industry === "string" ? o.industry.trim() : "";
  const isec = o.industrySector ?? null;
  if (industry && isec) return { mode: "industry", sector: isec, industry };
  const sector = o.sector ?? null;
  if (sector) return { mode: "sector", sector };
  return { mode: "all" };
}

export type ScreenerCompaniesApiResponseBody = {
  page: number;
  pageSize: number;
  total: number;
  rows: ScreenerTableRow[];
  sector: ScreenerCanonicalSector | null;
  industry: string | null;
  industrySector: ScreenerCanonicalSector | null;
};

/**
 * Paginated screener company rows — loads market slices per page so we do not fan out quotes/EOD for the full page-2 set unless needed.
 * With `sector`, lists the universe subset for that canonical GICS sector (market cap order), any page via {@link buildScreenerPage2RowsForTickers}.
 * With `industry` + `industrySector`, lists that industry inside the canonical sector (takes precedence over `sector`).
 */
async function buildScreenerCompaniesApiResponseUncached(
  page: number,
  pageSize: number,
  list: ScreenerCompaniesListMode,
): Promise<ScreenerCompaniesApiResponseBody> {
  const staticLayer = await getScreenerCompaniesStaticLayer();

  if (list.mode === "industry") {
    const filtered = filterAndSortUniverseByIndustry(staticLayer.universe, list.sector, list.industry);
    const total = filtered.length;
    const globalStart = (page - 1) * pageSize;
    if (globalStart >= total) {
      return {
        page,
        pageSize,
        total,
        rows: [],
        sector: null,
        industry: list.industry,
        industrySector: list.sector,
      };
    }
    const globalEnd = Math.min(globalStart + pageSize, total);
    const tickers = filtered.slice(globalStart, globalEnd).map((u) => u.ticker);
    const rows = await buildScreenerPage2RowsForTickers(tickers, staticLayer.universe, globalStart + 1);
    return {
      page,
      pageSize,
      total,
      rows,
      sector: null,
      industry: list.industry,
      industrySector: list.sector,
    };
  }

  if (list.mode === "sector") {
    const filtered = filterAndSortUniverseByCanonicalSector(staticLayer.universe, list.sector);
    const total = filtered.length;
    const globalStart = (page - 1) * pageSize;
    if (globalStart >= total) {
      return {
        page,
        pageSize,
        total,
        rows: [],
        sector: list.sector,
        industry: null,
        industrySector: null,
      };
    }
    const globalEnd = Math.min(globalStart + pageSize, total);
    const tickers = filtered.slice(globalStart, globalEnd).map((u) => u.ticker);
    const rows = await buildScreenerPage2RowsForTickers(tickers, staticLayer.universe, globalStart + 1);
    return {
      page,
      pageSize,
      total,
      rows,
      sector: list.sector,
      industry: null,
      industrySector: null,
    };
  }

  const page2Tickers = pickScreenerPage2Tickers(staticLayer.universe);
  const top10Len = TOP10_TICKERS.length;
  const total = top10Len + page2Tickers.length;
  const globalStart = (page - 1) * pageSize;
  if (globalStart >= total) {
    return { page, pageSize, total, rows: [], sector: null, industry: null, industrySector: null };
  }
  const globalEnd = Math.min(globalStart + pageSize, total);
  const rows: ScreenerTableRow[] = [];

  if (globalStart < top10Len) {
    const [data, derived] = await Promise.all([
      getSimpleMarketDataScreenerStocks(),
      getSimpleScreenerDerivedTop10(),
    ]);
    const { page1 } = await buildStockScreenerTablePages(data, staticLayer.universe, derived);
    for (let g = globalStart; g < Math.min(globalEnd, top10Len); g++) {
      rows.push(page1[g]!);
    }
  }

  if (globalEnd > top10Len) {
    const p2From = Math.max(0, globalStart - top10Len);
    const p2To = Math.min(page2Tickers.length, globalEnd - top10Len);
    const tickers = page2Tickers.slice(p2From, p2To);
    if (tickers.length) {
      const rankStart = top10Len + p2From + 1;
      const p2Rows = await buildScreenerPage2RowsForTickers(tickers, staticLayer.universe, rankStart);
      rows.push(...p2Rows);
    }
  }

  return { page, pageSize, total, rows, sector: null, industry: null, industrySector: null };
}

/**
 * Cached per list slice so RSC + `/api/screener/companies` and many users reuse one EODHD/realtime build within
 * {@link REVALIDATE_SCREENER_MARKET} (same tier as tab quote batches).
 */
export async function buildScreenerCompaniesApiResponse(
  page: number,
  pageSize: number,
  opts?: ScreenerCompaniesApiQueryOpts,
): Promise<ScreenerCompaniesApiResponseBody> {
  const p = Math.max(1, Math.trunc(page)) || 1;
  const ps = Math.min(50, Math.max(1, Math.trunc(pageSize))) || SCREENER_MARKETS_PAGE_SIZE;
  const list = resolveScreenerCompaniesListMode(opts);
  const listKey = list.mode === "all" ? "all" : list.mode === "sector" ? `sector:${list.sector}` : `industry:${list.sector}:${list.industry}`;
  return unstable_cache(
    () => buildScreenerCompaniesApiResponseUncached(p, ps, list),
    ["screener-companies-api-response-v2", String(p), String(ps), listKey],
    { revalidate: REVALIDATE_SCREENER_MARKET },
  )();
}

/** Paginated screener crypto rows — page 1 uses cached tab layers; page 2 loads on demand. */
export async function buildCryptoScreenerApiResponse(
  page: number,
  pageSize: number,
): Promise<{ page: number; pageSize: number; total: number; rows: CryptoTop10Row[] }> {
  const topLen = CRYPTO_TOP10.length;
  const total = topLen + CRYPTO_SCREENER_PAGE2.length;
  const globalStart = (page - 1) * pageSize;
  if (globalStart >= total) {
    return { page, pageSize, total, rows: [] };
  }
  const globalEnd = Math.min(globalStart + pageSize, total);
  const rows: CryptoTop10Row[] = [];

  if (globalStart < topLen) {
    const [data, derived] = await Promise.all([
      getSimpleMarketDataCryptoTab(),
      getSimpleCryptoDerivedTop10(),
    ]);
    const all = cryptoScreenerRowsFromMetas(CRYPTO_TOP10, data, derived);
    for (let g = globalStart; g < Math.min(globalEnd, topLen); g++) {
      rows.push(all[g]!);
    }
  }

  if (globalEnd > topLen) {
    const p2From = Math.max(0, globalStart - topLen);
    const p2To = Math.min(CRYPTO_SCREENER_PAGE2.length, globalEnd - topLen);
    const metas = CRYPTO_SCREENER_PAGE2.slice(p2From, p2To);
    if (metas.length) {
      const [data, derived] = await Promise.all([
        getSimpleMarketDataCryptoScreenerPage2(),
        getSimpleCryptoDerivedForMetas(metas),
      ]);
      rows.push(...cryptoScreenerRowsFromMetas(metas, data, derived));
    }
  }

  return { page, pageSize, total, rows };
}

/** Full stock list (top 10 + page 2) for Gainers & Losers — uses shared cached full market + derived layers. */
export async function buildScreenerAllStockRowsForGainers(): Promise<ScreenerTableRow[]> {
  const [data, staticLayer, stockDerived] = await Promise.all([
    getSimpleMarketDataScreenerStocksAllPages(),
    getScreenerCompaniesStaticLayer(),
    getSimpleScreenerDerived(),
  ]);
  const { page1, page2 } = await buildStockScreenerTablePages(data, staticLayer.universe, stockDerived);
  return [...page1, ...page2];
}

export async function buildScreenerPagePayload(
  market: ScreenerMarketTab,
  opts?: {
    stocksSector?: ScreenerCanonicalSector | null;
    stocksIndustry?: ScreenerIndustryDrill | null;
  },
): Promise<ScreenerPagePayload> {
  const stocksSector = opts?.stocksSector ?? null;
  const stocksIndustry = opts?.stocksIndustry ?? null;

  if (market === "crypto") {
    const cryptoFirst = await buildCryptoScreenerApiResponse(1, SCREENER_MARKETS_PAGE_SIZE);
    return {
      market: "crypto",
      cryptoRows: cryptoFirst.rows,
      cryptoTotalCount: cryptoFirst.total,
    };
  }
  if (market === "indices") {
    const [data, indicesDerived] = await Promise.all([getSimpleMarketDataIndicesTab(), getSimpleIndicesDerived()]);
    return { market: "indices", indicesRows: indicesTableRowsFromSimpleLayers(data, indicesDerived) };
  }

  const companiesApiOpts: ScreenerCompaniesApiQueryOpts = stocksIndustry
    ? {
        sector: null,
        industry: stocksIndustry.industry,
        industrySector: stocksIndustry.sector,
      }
    : { sector: stocksSector, industry: null, industrySector: null };

  const [indexCards, staticLayer, companiesFirst, sectorEtfYtd] = await Promise.all([
    getSimpleIndexCards(),
    getScreenerCompaniesStaticLayer(),
    buildScreenerCompaniesApiResponse(1, SCREENER_MARKETS_PAGE_SIZE, companiesApiOpts),
    getScreenerSectorEtfProxyYtdBySector(),
  ]);

  const { sectors, industries } = buildScreenerSectorsAndIndustriesRows(staticLayer.universe);
  const sectorsWithYtdFallback = sectors.map((row) => {
    const hasAggregateYtd = row.changeYTD != null && Number.isFinite(row.changeYTD);
    if (hasAggregateYtd) return row;
    const proxy = sectorEtfYtd[row.sector as ScreenerCanonicalSector];
    if (proxy != null && Number.isFinite(proxy)) {
      return { ...row, changeYTD: proxy };
    }
    return row;
  });

  const industriesWithYtdFallback = industries.map((row) => {
    const hasAggregateYtd = row.changeYTD != null && Number.isFinite(row.changeYTD);
    if (hasAggregateYtd) return row;
    const proxy = sectorEtfYtd[row.sector as ScreenerCanonicalSector];
    if (proxy != null && Number.isFinite(proxy)) {
      return { ...row, changeYTD: proxy };
    }
    return row;
  });

  const stocksIndustryFilter: ScreenerIndustryDrill | null =
    companiesFirst.industry != null && companiesFirst.industrySector != null
      ? { sector: companiesFirst.industrySector, industry: companiesFirst.industry }
      : null;

  return {
    market: "stocks",
    stockRows: companiesFirst.rows,
    stocksTotalCount: companiesFirst.total,
    stocksSectorFilter: companiesFirst.sector,
    stocksIndustryFilter,
    indexCards,
    sectors: sectorsWithYtdFallback,
    industries: industriesWithYtdFallback,
  };
}
