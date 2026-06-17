import "server-only";

import { readMarketSnapshot } from "@/lib/market/market-snapshot-store";
import { MARKET_SNAPSHOT_KEY } from "@/lib/market/market-snapshot-keys";
import type { ScreenerIndustryRow } from "@/lib/screener/screener-industries-types";
import type { ScreenerSectorRow } from "@/lib/screener/screener-sectors-types";
import type { ScreenerTableRow } from "@/lib/screener/screener-static";
import {
  buildScreenerGainersLosersFromUniverse,
  buildScreenerIndustriesFromUniverse,
  buildScreenerSectorsFromUniverse,
  type ScreenerGainersLosersSnapshot,
} from "@/lib/screener/screener-stocks-subtab-snapshot-ingest";
import { getTop500UniverseMarketSnapshot } from "@/lib/screener/top500-companies";
import { withScreenerUsMarketCache } from "@/lib/screener/screener-us-market-cache";

async function buildScreenerSectorsUncached(): Promise<{ sectors: ScreenerSectorRow[] }> {
  const universe = await getTop500UniverseMarketSnapshot();
  const sectors = await buildScreenerSectorsFromUniverse(universe);
  return { sectors };
}

async function buildScreenerIndustriesUncached(): Promise<{ industries: ScreenerIndustryRow[] }> {
  const universe = await getTop500UniverseMarketSnapshot();
  return { industries: buildScreenerIndustriesFromUniverse(universe) };
}

async function buildScreenerGainersLosersUncached(): Promise<ScreenerGainersLosersSnapshot> {
  const universe = await getTop500UniverseMarketSnapshot();
  return buildScreenerGainersLosersFromUniverse(universe);
}

export async function buildScreenerSectorsApiResponse(): Promise<{ sectors: ScreenerSectorRow[] }> {
  const snap = await readMarketSnapshot<ScreenerSectorRow[]>(MARKET_SNAPSHOT_KEY.screenerSectors);
  if (snap?.length) return { sectors: snap };
  return withScreenerUsMarketCache("screener-sectors-table-v1", buildScreenerSectorsUncached);
}

export async function buildScreenerIndustriesApiResponse(): Promise<{ industries: ScreenerIndustryRow[] }> {
  const snap = await readMarketSnapshot<ScreenerIndustryRow[]>(MARKET_SNAPSHOT_KEY.screenerIndustries);
  if (snap?.length) return { industries: snap };
  return withScreenerUsMarketCache("screener-industries-table-v1", buildScreenerIndustriesUncached);
}

export async function buildScreenerGainersLosersApiResponse(): Promise<ScreenerGainersLosersSnapshot> {
  const snap = await readMarketSnapshot<ScreenerGainersLosersSnapshot>(MARKET_SNAPSHOT_KEY.screenerGainersLosers);
  if (snap?.gainers?.length && snap?.losers?.length) return snap;
  return withScreenerUsMarketCache("screener-gainers-losers-v3-derived-1m-ytd", buildScreenerGainersLosersUncached);
}

/** @deprecated Use {@link buildScreenerGainersLosersApiResponse} — avoids 500-ticker quote fan-out. */
export async function buildScreenerAllStockRowsForGainers(): Promise<ScreenerTableRow[]> {
  const { gainers, losers } = await buildScreenerGainersLosersApiResponse();
  return [...gainers, ...losers];
}
