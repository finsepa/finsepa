import { mapProviderSectorToCanonical, type ScreenerCanonicalSector } from "@/lib/screener/screener-gics-sectors";
import type { TopCompanyUniverseRow } from "@/lib/screener/top500-companies";

/** Universe rows in that canonical sector, market cap descending (for Companies pagination). */
export function filterAndSortUniverseByCanonicalSector(
  universe: readonly TopCompanyUniverseRow[],
  sector: ScreenerCanonicalSector,
): TopCompanyUniverseRow[] {
  const out = universe.filter((u) => mapProviderSectorToCanonical(u.sector) === sector);
  out.sort((a, b) => b.marketCapUsd - a.marketCapUsd || a.ticker.localeCompare(b.ticker));
  return out;
}

/** Same industry label rules as `buildScreenerSectorsAndIndustriesRows` (universe aggregates). */
function universeIndustryLabel(u: TopCompanyUniverseRow): string {
  const rawInd = u.industry?.trim() ?? "";
  return rawInd.length > 0 ? rawInd : "Unclassified";
}

/** Universe rows in that canonical sector and industry (GICS industry string), market cap descending. */
export function filterAndSortUniverseByIndustry(
  universe: readonly TopCompanyUniverseRow[],
  canonicalSector: ScreenerCanonicalSector,
  industryLabel: string,
): TopCompanyUniverseRow[] {
  const want = industryLabel.trim();
  if (!want) return [];
  const out = universe.filter((u) => {
    if (mapProviderSectorToCanonical(u.sector) !== canonicalSector) return false;
    return universeIndustryLabel(u) === want;
  });
  out.sort((a, b) => b.marketCapUsd - a.marketCapUsd || a.ticker.localeCompare(b.ticker));
  return out;
}
