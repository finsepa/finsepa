import "server-only";

import { unstable_cache } from "next/cache";

import { REVALIDATE_STATIC_DAY } from "@/lib/data/cache-policy";

/** Same shape as {@link MacroPoint} in `eodhd-macro` — kept local to avoid import cycles. */
export type BlsCpiMacroPoint = { time: string; value: number };

const BLS_CPI_ALL_ITEMS_URL = "https://download.bls.gov/pub/time.series/cu/cu.data.1.AllItems";
/** CPI-U All Items, seasonally adjusted (1982–84 = 100). */
const BLS_SERIES_ID = "CUSR0000SA0";
const BASE_YEAR = 2010;

function blsUserAgent(): string {
  const fromEnv = process.env.SEC_EDGAR_USER_AGENT?.trim();
  return fromEnv || "FinsepaMacro/1.0 (+https://finsepa.com)";
}

function blsPeriodToYmd(year: number, period: string): string | null {
  const m = /^M(\d{2})$/.exec(period.trim());
  if (!m) return null;
  return `${year}-${m[1]}-01`;
}

function parseNum(raw: string): number | null {
  const n = Number(raw.trim());
  return Number.isFinite(n) ? n : null;
}

/**
 * Monthly US CPI index rebased to 2010 = 100 (matches EODHD / World Bank macro card scale).
 *
 * Source: BLS public time-series export (no API key). Requires a descriptive User-Agent.
 *
 * @see https://www.bls.gov/cpi/
 */
function parseBlsCpiIndexText(text: string): BlsCpiMacroPoint[] {
  const lines = text.split(/\r?\n/);
  const raw: { time: string; value: number }[] = [];

  for (const line of lines) {
    if (!line.startsWith(BLS_SERIES_ID)) continue;
    const cols = line.split("\t");
    if (cols.length < 4) continue;
    const year = Number(cols[1]?.trim());
    const period = cols[2]?.trim() ?? "";
    const value = parseNum(cols[3] ?? "");
    if (!Number.isFinite(year) || value == null || value <= 0) continue;
    const ymd = blsPeriodToYmd(year, period);
    if (!ymd) continue;
    raw.push({ time: ymd, value });
  }

  if (!raw.length) return [];

  raw.sort((a, b) => a.time.localeCompare(b.time));

  const baseRow = raw.find((p) => p.time === `${BASE_YEAR}-01-01`);
  const baseValue = baseRow?.value ?? raw.find((p) => p.time.startsWith(`${BASE_YEAR}-`))?.value;
  if (!baseValue || baseValue <= 0) return [];

  return raw.map((p) => ({
    time: p.time,
    value: (p.value / baseValue) * 100,
  }));
}

async function fetchBlsCpiIndexUncached(): Promise<BlsCpiMacroPoint[]> {
  try {
    const res = await fetch(BLS_CPI_ALL_ITEMS_URL, {
      headers: { "User-Agent": blsUserAgent() },
      next: { revalidate: REVALIDATE_STATIC_DAY },
    });
    if (!res.ok) return [];
    const text = await res.text();
    return parseBlsCpiIndexText(text);
  } catch {
    return [];
  }
}

export const fetchBlsCpiIndexSeriesCached = unstable_cache(fetchBlsCpiIndexUncached, ["bls-cpi-index-v1"], {
  revalidate: REVALIDATE_STATIC_DAY,
});
