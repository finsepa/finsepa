import "server-only";

import { getScreenerCompaniesStaticLayer } from "@/lib/screener/screener-companies-layers";
import { buildScreenerPage2RowsForTickers } from "@/lib/screener/screener-page-payload";
import type { ScreenerIndustryRow } from "@/lib/screener/screener-industries-types";
import { buildScreenerSectorsAndIndustriesRows } from "@/lib/screener/screener-stocks-universe-aggregates";
import type { ScreenerSectorRow } from "@/lib/screener/screener-sectors-types";
import type { ScreenerCanonicalSector } from "@/lib/screener/screener-gics-sectors";
import { getScreenerSectorEtfProxyYtdBySector } from "@/lib/screener/screener-sector-etf-ytd";
import type { ScreenerTableRow } from "@/lib/screener/screener-static";
import { getTop500UniverseMarketSnapshot } from "@/lib/screener/top500-companies";
import { withScreenerUsMarketCache } from "@/lib/screener/screener-us-market-cache";

const GAINERS_LOSERS_TOP_N = 10;

async function buildScreenerSectorsUncached(): Promise<{ sectors: ScreenerSectorRow[] }> {
  const [universe, sectorEtfYtd] = await Promise.all([
    getTop500UniverseMarketSnapshot(),
    getScreenerSectorEtfProxyYtdBySector(),
  ]);
  const { sectors } = buildScreenerSectorsAndIndustriesRows(universe);
  const sectorsWithYtdFallback = sectors.map((row) => {
    const hasAggregateYtd = row.changeYTD != null && Number.isFinite(row.changeYTD);
    if (hasAggregateYtd) return row;
    const proxy = sectorEtfYtd[row.sector as ScreenerCanonicalSector];
    if (proxy != null && Number.isFinite(proxy)) {
      return { ...row, changeYTD: proxy };
    }
    return row;
  });
  return { sectors: sectorsWithYtdFallback };
}

async function buildScreenerIndustriesUncached(): Promise<{ industries: ScreenerIndustryRow[] }> {
  const universe = await getTop500UniverseMarketSnapshot();
  const { industries } = buildScreenerSectorsAndIndustriesRows(universe);
  return { industries };
}

async function buildScreenerGainersLosersUncached(): Promise<{
  gainers: ScreenerTableRow[];
  losers: ScreenerTableRow[];
}> {
  const [universe, { identityByTicker }] = await Promise.all([
    getTop500UniverseMarketSnapshot(),
    getScreenerCompaniesStaticLayer(),
  ]);
  const valid = universe.filter((u) => u.refund1dP != null && Number.isFinite(u.refund1dP));
  const by1dDesc = [...valid].sort((a, b) => (b.refund1dP ?? 0) - (a.refund1dP ?? 0));
  const by1dAsc = [...valid].sort((a, b) => (a.refund1dP ?? 0) - (b.refund1dP ?? 0));
  const gainerTickers = by1dDesc.slice(0, GAINERS_LOSERS_TOP_N).map((u) => u.ticker);
  const loserTickers = by1dAsc.slice(0, GAINERS_LOSERS_TOP_N).map((u) => u.ticker);
  const [gainers, losers] = await Promise.all([
    buildScreenerPage2RowsForTickers(gainerTickers, universe, 1, identityByTicker),
    buildScreenerPage2RowsForTickers(loserTickers, universe, 1, identityByTicker),
  ]);
  return { gainers, losers };
}

export async function buildScreenerSectorsApiResponse(): Promise<{ sectors: ScreenerSectorRow[] }> {
  return withScreenerUsMarketCache("screener-sectors-table-v1", buildScreenerSectorsUncached);
}

export async function buildScreenerIndustriesApiResponse(): Promise<{ industries: ScreenerIndustryRow[] }> {
  return withScreenerUsMarketCache("screener-industries-table-v1", buildScreenerIndustriesUncached);
}

export async function buildScreenerGainersLosersApiResponse(): Promise<{
  gainers: ScreenerTableRow[];
  losers: ScreenerTableRow[];
}> {
  return withScreenerUsMarketCache("screener-gainers-losers-v3-derived-1m-ytd", buildScreenerGainersLosersUncached);
}

/** @deprecated Use {@link buildScreenerGainersLosersApiResponse} — avoids 500-ticker quote fan-out. */
export async function buildScreenerAllStockRowsForGainers(): Promise<ScreenerTableRow[]> {
  const { gainers, losers } = await buildScreenerGainersLosersApiResponse();
  return [...gainers, ...losers];
}
