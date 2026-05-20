import "server-only";

import { formatMarketCapCompactNoCurrency } from "@/lib/screener/eod-derived-metrics";
import type { ScreenerIndustryRow } from "@/lib/screener/screener-industries-types";
import { mapProviderSectorToCanonical, SCREENER_SECTOR_TABLE_ORDER } from "@/lib/screener/screener-gics-sectors";
import type { ScreenerSectorRow } from "@/lib/screener/screener-sectors-types";
import type { TopCompanyUniverseRow } from "@/lib/screener/top500-companies";

function pickCapWeightedPct(snapshot: number | null | undefined, fromBars: number | null | undefined): number | null {
  if (snapshot != null && Number.isFinite(snapshot)) return snapshot;
  if (fromBars != null && Number.isFinite(fromBars)) return fromBars;
  return null;
}

export type ScreenerUniverseDerivedPctByTicker = Readonly<
  Record<string, { changePercent1M: number | null; changePercentYTD: number | null }>
>;

type CapWeightedAgg = {
  marketCapUsd: number;
  weighted1dNum: number;
  weighted1dDenom: number;
  weightedYtdNum: number;
  weightedYtdDenom: number;
};

function emptyAgg(): CapWeightedAgg {
  return {
    marketCapUsd: 0,
    weighted1dNum: 0,
    weighted1dDenom: 0,
    weightedYtdNum: 0,
    weightedYtdDenom: 0,
  };
}

function addUniverseRow(target: CapWeightedAgg, mc: number, refund1dP: number | null, refundYtdP: number | null) {
  target.marketCapUsd += mc;
  const r1d = refund1dP;
  if (r1d != null && Number.isFinite(r1d)) {
    target.weighted1dNum += mc * r1d;
    target.weighted1dDenom += mc;
  }
  const rytd = refundYtdP;
  if (rytd != null && Number.isFinite(rytd)) {
    target.weightedYtdNum += mc * rytd;
    target.weightedYtdDenom += mc;
  }
}

/**
 * One pass over the screener equity universe: sector rows (GICS table order) + industry rows.
 * No extra I/O beyond what already produced `universe` (e.g. {@link getScreenerCompaniesStaticLayer}).
 */
export function buildScreenerSectorsAndIndustriesRows(
  universe: readonly TopCompanyUniverseRow[],
  derivedByTicker?: ScreenerUniverseDerivedPctByTicker,
): {
  sectors: ScreenerSectorRow[];
  industries: ScreenerIndustryRow[];
} {
  const sectorAgg = new Map<string, CapWeightedAgg>();
  for (const s of SCREENER_SECTOR_TABLE_ORDER) sectorAgg.set(s, emptyAgg());

  const industryAgg = new Map<string, CapWeightedAgg & { sector: string; industry: string }>();

  for (const u of universe) {
    const canon = mapProviderSectorToCanonical(u.sector);
    if (!canon) continue;
    const mc = u.marketCapUsd;
    const tk = u.ticker.trim().toUpperCase();
    const barDerived = derivedByTicker?.[tk];
    const ytdPct = pickCapWeightedPct(u.refundYtdP, barDerived?.changePercentYTD);

    addUniverseRow(sectorAgg.get(canon)!, mc, u.refund1dP, ytdPct);

    const rawInd = u.industry?.trim() ?? "";
    const industry = rawInd.length > 0 ? rawInd : "Unclassified";
    const ikey = `${canon}\0${industry}`;
    let ir = industryAgg.get(ikey);
    if (!ir) {
      ir = { sector: canon, industry, ...emptyAgg() };
      industryAgg.set(ikey, ir);
    }
    addUniverseRow(ir, mc, u.refund1dP, ytdPct);
  }

  const sectors: ScreenerSectorRow[] = SCREENER_SECTOR_TABLE_ORDER.map((sector) => {
    const a = sectorAgg.get(sector)!;
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

  sectors.sort((a, b) => {
    const d = b.marketCapUsd - a.marketCapUsd;
    if (d !== 0) return d;
    return a.sector.localeCompare(b.sector);
  });

  const industries: ScreenerIndustryRow[] = [...industryAgg.values()].map((a) => {
    const mc = a.marketCapUsd;
    const change1D = a.weighted1dDenom > 0 ? a.weighted1dNum / a.weighted1dDenom : null;
    const changeYTD = a.weightedYtdDenom > 0 ? a.weightedYtdNum / a.weightedYtdDenom : null;
    return {
      rank: 0,
      sector: a.sector,
      industry: a.industry,
      marketCapUsd: mc,
      marketCapDisplay: formatMarketCapCompactNoCurrency(mc > 0 ? mc : null),
      change1D,
      changeYTD,
    };
  });

  industries.sort((a, b) => {
    const d = b.marketCapUsd - a.marketCapUsd;
    if (d !== 0) return d;
    const s = a.sector.localeCompare(b.sector);
    if (s !== 0) return s;
    return a.industry.localeCompare(b.industry);
  });

  return {
    sectors: sectors.map((row, i) => ({ ...row, rank: i + 1 })),
    industries: industries.map((row, i) => ({ ...row, rank: i + 1 })),
  };
}
