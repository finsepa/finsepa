import "server-only";

import { getScreenerCompaniesStaticLayer } from "@/lib/screener/screener-companies-layers";
import { buildScreenerPage2RowsForTickers } from "@/lib/screener/screener-page-payload";
import type { ScreenerIndustryRow } from "@/lib/screener/screener-industries-types";
import { buildScreenerSectorsAndIndustriesRows } from "@/lib/screener/screener-stocks-universe-aggregates";
import type { ScreenerSectorRow } from "@/lib/screener/screener-sectors-types";
import type { ScreenerCanonicalSector } from "@/lib/screener/screener-gics-sectors";
import { getScreenerSectorEtfProxyYtdBySector } from "@/lib/screener/screener-sector-etf-ytd";
import type { ScreenerTableRow } from "@/lib/screener/screener-static";
import type { TopCompanyUniverseRow } from "@/lib/screener/top500-companies";
import { buildTop500MarketSnapshotForIngest } from "@/lib/screener/top500-companies";

const GAINERS_LOSERS_TOP_N = 10;

export type ScreenerGainersLosersSnapshot = {
  gainers: ScreenerTableRow[];
  losers: ScreenerTableRow[];
};

export async function buildScreenerSectorsFromUniverse(
  universe: readonly TopCompanyUniverseRow[],
): Promise<ScreenerSectorRow[]> {
  const sectorEtfYtd = await getScreenerSectorEtfProxyYtdBySector();
  const { sectors } = buildScreenerSectorsAndIndustriesRows(universe);
  return sectors.map((row) => {
    const hasAggregateYtd = row.changeYTD != null && Number.isFinite(row.changeYTD);
    if (hasAggregateYtd) return row;
    const proxy = sectorEtfYtd[row.sector as ScreenerCanonicalSector];
    if (proxy != null && Number.isFinite(proxy)) {
      return { ...row, changeYTD: proxy };
    }
    return row;
  });
}

export function buildScreenerIndustriesFromUniverse(
  universe: readonly TopCompanyUniverseRow[],
): ScreenerIndustryRow[] {
  const { industries } = buildScreenerSectorsAndIndustriesRows(universe);
  return industries;
}

export async function buildScreenerGainersLosersFromUniverse(
  universe: readonly TopCompanyUniverseRow[],
): Promise<ScreenerGainersLosersSnapshot> {
  const { identityByTicker } = await getScreenerCompaniesStaticLayer();
  const valid = universe.filter((u) => u.refund1dP != null && Number.isFinite(u.refund1dP));
  const by1dDesc = [...valid].sort((a, b) => (b.refund1dP ?? 0) - (a.refund1dP ?? 0));
  const by1dAsc = [...valid].sort((a, b) => (a.refund1dP ?? 0) - (b.refund1dP ?? 0));
  const gainerTickers = by1dDesc.slice(0, GAINERS_LOSERS_TOP_N).map((u) => u.ticker);
  const loserTickers = by1dAsc.slice(0, GAINERS_LOSERS_TOP_N).map((u) => u.ticker);
  const universeRows = [...universe];
  const [gainers, losers] = await Promise.all([
    buildScreenerPage2RowsForTickers(gainerTickers, universeRows, 1, identityByTicker),
    buildScreenerPage2RowsForTickers(loserTickers, universeRows, 1, identityByTicker),
  ]);
  return { gainers, losers };
}

/** Cron-only: one shared top-500 + subtab build per hot segment for all users. */
export async function buildScreenerStocksSubtabSnapshotsForIngest(): Promise<{
  top500Market: TopCompanyUniverseRow[];
  sectors: ScreenerSectorRow[];
  industries: ScreenerIndustryRow[];
  gainersLosers: ScreenerGainersLosersSnapshot;
}> {
  const top500Market = await buildTop500MarketSnapshotForIngest();
  const [sectors, industries, gainersLosers] = await Promise.all([
    buildScreenerSectorsFromUniverse(top500Market),
    Promise.resolve(buildScreenerIndustriesFromUniverse(top500Market)),
    buildScreenerGainersLosersFromUniverse(top500Market),
  ]);
  return { top500Market, sectors, industries, gainersLosers };
}
