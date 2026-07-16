import "server-only";

import { unstable_cache } from "next/cache";

import { REVALIDATE_STATIC_DAY } from "@/lib/data/cache-policy";

/** Same shape as {@link MacroPoint} in `eodhd-macro` — kept local to avoid import cycles. */
export type GdpDeflatorMacroPoint = { time: string; value: number };

/**
 * FRED Gross Domestic Product: Implicit Price Deflator (index, quarterly).
 * YoY % change matches the Macro “GDP deflator” inflation card more closely than
 * World Bank annual `inflation_gdp_deflator_annual` (lags a full year).
 *
 * @see https://fred.stlouisfed.org/series/GDPDEF
 */
const FRED_GDPDEF_CSV_URL = "https://fred.stlouisfed.org/graph/fredgraph.csv?id=GDPDEF";

function fredUserAgent(): string {
  const fromEnv = process.env.SEC_EDGAR_USER_AGENT?.trim();
  return fromEnv || "FinsepaMacro/1.0 (+https://finsepa.com)";
}

function parseFredGdpDefCsv(text: string): GdpDeflatorMacroPoint[] {
  const lines = text.split(/\r?\n/);
  const out: GdpDeflatorMacroPoint[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("observation_date") || trimmed.startsWith("DATE")) continue;
    const [dateRaw, valueRaw] = trimmed.split(",");
    const date = dateRaw?.trim().slice(0, 10) ?? "";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    const value = Number(valueRaw?.trim());
    if (!Number.isFinite(value) || value <= 0) continue;
    out.push({ time: date, value });
  }
  out.sort((a, b) => a.time.localeCompare(b.time));
  return out;
}

/** Four quarters earlier (same calendar quarter). */
function priorYearQuarter(ymd: string): string {
  const y = Number(ymd.slice(0, 4));
  const rest = ymd.slice(4);
  return `${y - 1}${rest}`;
}

function yoyFromGdpDefIndex(index: GdpDeflatorMacroPoint[]): GdpDeflatorMacroPoint[] {
  const byDate = new Map(index.map((p) => [p.time, p.value]));
  const out: GdpDeflatorMacroPoint[] = [];
  for (const p of index) {
    const prior = byDate.get(priorYearQuarter(p.time));
    if (prior == null || prior <= 0) continue;
    const rate = (p.value / prior - 1) * 100;
    if (!Number.isFinite(rate)) continue;
    out.push({ time: p.time, value: Math.round(rate * 100) / 100 });
  }
  return out;
}

async function fetchGdpDeflatorYoyUncached(): Promise<GdpDeflatorMacroPoint[]> {
  try {
    const res = await fetch(FRED_GDPDEF_CSV_URL, {
      headers: { "User-Agent": fredUserAgent(), Accept: "text/csv,*/*" },
      next: { revalidate: REVALIDATE_STATIC_DAY },
    });
    if (!res.ok) return [];
    const text = await res.text();
    if (!text.trim() || text.trimStart().startsWith("<!")) return [];
    return yoyFromGdpDefIndex(parseFredGdpDefCsv(text));
  } catch {
    return [];
  }
}

export const fetchGdpDeflatorYoySeriesCached = unstable_cache(
  fetchGdpDeflatorYoyUncached,
  ["fred-gdpdef-yoy-v1"],
  { revalidate: REVALIDATE_STATIC_DAY },
);
