import "server-only";

import { formatMarketCapCompactNoCurrency } from "@/lib/screener/eod-derived-metrics";
import { mapProviderSectorToCanonical, SCREENER_SECTOR_TABLE_ORDER } from "@/lib/screener/screener-gics-sectors";
import type { ScreenerSectorRow } from "@/lib/screener/screener-sectors-types";
import type { TopCompanyUniverseRow } from "@/lib/screener/top500-companies";

type SectorAgg = {
  marketCapUsd: number;
  weighted1dNum: number;
  weighted1dDenom: number;
  weightedYtdNum: number;
  weightedYtdDenom: number;
};

function emptyAgg(): SectorAgg {
  return {
    marketCapUsd: 0,
    weighted1dNum: 0,
    weighted1dDenom: 0,
    weightedYtdNum: 0,
    weightedYtdDenom: 0,
  };
}

/**
 * GICS-style sector rows: aggregate **market cap** and **market-cap-weighted** 1D / YTD % moves from the
 * full EODHD [Stock Market Screener](https://eodhd.com/financial-apis/stock-market-screener-api) universe
 * (`getTop500Universe` — same `refund1dP` / `refundYtdP` snapshot as Companies), then **sort by market cap descending**
 * (ties broken by sector name). `rank` reflects this order.
 */
export function buildScreenerSectorsRows(universe: readonly TopCompanyUniverseRow[]): ScreenerSectorRow[] {
  const agg = new Map<string, SectorAgg>();
  for (const s of SCREENER_SECTOR_TABLE_ORDER) agg.set(s, emptyAgg());

  for (const u of universe) {
    const canon = mapProviderSectorToCanonical(u.sector);
    if (!canon) continue;
    const a = agg.get(canon)!;
    const mc = u.marketCapUsd;
    a.marketCapUsd += mc;

    const r1d = u.refund1dP;
    if (r1d != null && Number.isFinite(r1d)) {
      a.weighted1dNum += mc * r1d;
      a.weighted1dDenom += mc;
    }
    const rytd = u.refundYtdP;
    if (rytd != null && Number.isFinite(rytd)) {
      a.weightedYtdNum += mc * rytd;
      a.weightedYtdDenom += mc;
    }
  }

  const rows: ScreenerSectorRow[] = SCREENER_SECTOR_TABLE_ORDER.map((sector) => {
    const a = agg.get(sector)!;
    const mc = a.marketCapUsd;
    const change1D = a.weighted1dDenom > 0 ? a.weighted1dNum / a.weighted1dDenom : null;
    const changeYTD = a.weightedYtdDenom > 0 ? a.weightedYtdNum / a.weightedYtdDenom : null;
    return {
      rank: 0,
      sector,
      marketCapUsd: mc,
      marketCapDisplay: formatMarketCapCompactNoCurrency(mc > 0 ? mc : null),
      change1D,
      changeYTD,
    };
  });

  rows.sort((a, b) => {
    const d = b.marketCapUsd - a.marketCapUsd;
    if (d !== 0) return d;
    return a.sector.localeCompare(b.sector);
  });

  return rows.map((row, i) => ({ ...row, rank: i + 1 }));
}
