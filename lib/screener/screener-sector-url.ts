import {
  SCREENER_SECTOR_TABLE_ORDER,
  type ScreenerCanonicalSector,
} from "@/lib/screener/screener-gics-sectors";

/** Query key: Companies tab filtered to a GICS-style sector (canonical label, e.g. `Technology`). */
export const SCREENER_SECTOR_QUERY = "sector" as const;

export function parseScreenerSectorParam(raw: string | null | undefined): ScreenerCanonicalSector | null {
  const v = raw?.trim();
  if (!v) return null;
  return (SCREENER_SECTOR_TABLE_ORDER as readonly string[]).includes(v) ? (v as ScreenerCanonicalSector) : null;
}

export function screenerSectorCompaniesHref(sector: ScreenerCanonicalSector): string {
  const params = new URLSearchParams();
  params.set(SCREENER_SECTOR_QUERY, sector);
  return `/screener?${params.toString()}`;
}
