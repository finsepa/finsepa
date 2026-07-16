import "server-only";

import { unstable_cache } from "next/cache";

import { REVALIDATE_STATIC_DAY } from "@/lib/data/cache-policy";

/** Same shape as {@link MacroPoint} in `eodhd-macro` — kept local to avoid import cycles. */
export type FredUnemploymentMacroPoint = { time: string; value: number };

/**
 * FRED monthly Civilian Unemployment Rate (UNRATE).
 * Fresher than annual World Bank / EODHD `unemployment_total_percent`.
 *
 * @see https://fred.stlouisfed.org/series/UNRATE
 */
const FRED_UNRATE_CSV_URL = "https://fred.stlouisfed.org/graph/fredgraph.csv?id=UNRATE";

function fredUserAgent(): string {
  const fromEnv = process.env.SEC_EDGAR_USER_AGENT?.trim();
  return fromEnv || "FinsepaMacro/1.0 (+https://finsepa.com)";
}

function parseFredUnrateCsv(text: string): FredUnemploymentMacroPoint[] {
  const lines = text.split(/\r?\n/);
  const out: FredUnemploymentMacroPoint[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("observation_date") || trimmed.startsWith("DATE")) continue;
    const [dateRaw, valueRaw] = trimmed.split(",");
    const date = dateRaw?.trim().slice(0, 10) ?? "";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    const value = Number(valueRaw?.trim());
    if (!Number.isFinite(value)) continue;
    out.push({ time: date, value });
  }
  out.sort((a, b) => a.time.localeCompare(b.time));
  return out;
}

async function fetchFredUnrateUncached(): Promise<FredUnemploymentMacroPoint[]> {
  try {
    const res = await fetch(FRED_UNRATE_CSV_URL, {
      headers: { "User-Agent": fredUserAgent(), Accept: "text/csv,*/*" },
      next: { revalidate: REVALIDATE_STATIC_DAY },
    });
    if (!res.ok) return [];
    const text = await res.text();
    if (!text.trim() || text.trimStart().startsWith("<!")) return [];
    return parseFredUnrateCsv(text);
  } catch {
    return [];
  }
}

export const fetchFredUnrateSeriesCached = unstable_cache(fetchFredUnrateUncached, ["fred-unrate-v1"], {
  revalidate: REVALIDATE_STATIC_DAY,
});
