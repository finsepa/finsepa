import "server-only";

import { buildScreenerSectorsAndIndustriesRows } from "@/lib/screener/screener-stocks-universe-aggregates";
import type { ScreenerIndustryRow } from "@/lib/screener/screener-industries-types";
import type { TopCompanyUniverseRow } from "@/lib/screener/top500-companies";

/**
 * Industry rows from the screener universe (in-memory; no extra HTTP).
 * Prefer {@link buildScreenerSectorsAndIndustriesRows} when you also need sectors — one pass.
 */
export function buildScreenerIndustriesRows(universe: readonly TopCompanyUniverseRow[]): ScreenerIndustryRow[] {
  return buildScreenerSectorsAndIndustriesRows(universe).industries;
}
