import "server-only";

import { buildScreenerSectorsAndIndustriesRows } from "@/lib/screener/screener-stocks-universe-aggregates";
import type { ScreenerSectorRow } from "@/lib/screener/screener-sectors-types";
import type { TopCompanyUniverseRow } from "@/lib/screener/top500-companies";

/**
 * GICS-style sector rows from the screener universe (in-memory; no extra HTTP).
 * Prefer {@link buildScreenerSectorsAndIndustriesRows} when you also need industries — one pass.
 */
export function buildScreenerSectorsRows(universe: readonly TopCompanyUniverseRow[]): ScreenerSectorRow[] {
  return buildScreenerSectorsAndIndustriesRows(universe).sectors;
}
