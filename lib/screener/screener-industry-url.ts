import type { ScreenerCanonicalSector } from "@/lib/screener/screener-gics-sectors";
import { parseScreenerSectorParam } from "@/lib/screener/screener-sector-url";
import { SCREENER_STOCKS_SUB_TAB_QUERY } from "@/lib/screener/screener-stocks-sub-tab-url";

/** Query: industry label (must match universe / aggregates row, e.g. `Semiconductors`). */
export const SCREENER_INDUSTRY_QUERY = "industry" as const;

/** Query: canonical GICS sector parent (disambiguates industry label). */
export const SCREENER_INDUSTRY_SECTOR_QUERY = "industrySector" as const;

export type ScreenerIndustryDrill = {
  sector: ScreenerCanonicalSector;
  industry: string;
};

export function parseScreenerIndustryDrill(
  industryRaw: string | null | undefined,
  industrySectorRaw: string | null | undefined,
): ScreenerIndustryDrill | null {
  const sector = parseScreenerSectorParam(
    typeof industrySectorRaw === "string" ? industrySectorRaw : undefined,
  );
  const industry = typeof industryRaw === "string" ? industryRaw.trim() : "";
  if (!sector || !industry) return null;
  return { sector, industry };
}

/** Deep link: Industries tab, drilled into one industry (companies table below). */
export function screenerIndustryDrillHref(sector: ScreenerCanonicalSector, industry: string): string {
  const params = new URLSearchParams();
  params.set(SCREENER_INDUSTRY_SECTOR_QUERY, sector);
  params.set(SCREENER_INDUSTRY_QUERY, industry);
  params.set(SCREENER_STOCKS_SUB_TAB_QUERY, "Industries");
  return `/screener?${params.toString()}`;
}
