import "server-only";

import { unstable_cache } from "next/cache";

import { REVALIDATE_STATIC_DAY } from "@/lib/data/cache-policy";

/** Same shape as {@link MacroPoint} in `eodhd-macro` — kept local to avoid import cycles. */
export type FredGdpMacroPoint = { time: string; value: number };

/**
 * FRED nominal GDP (quarterly, SAAR, billions of dollars).
 * Converted to USD so Macro cards keep World Bank / EODHD scale ($T).
 *
 * @see https://fred.stlouisfed.org/series/GDP
 */
const FRED_GDP_CSV_URL = "https://fred.stlouisfed.org/graph/fredgraph.csv?id=GDP";

/**
 * FRED real GDP (chained 2017 dollars, quarterly).
 * YoY % is the Multpl-style growth rate (fresher than annual World Bank).
 *
 * @see https://fred.stlouisfed.org/series/GDPC1
 */
const FRED_GDPC1_CSV_URL = "https://fred.stlouisfed.org/graph/fredgraph.csv?id=GDPC1";

/**
 * FRED nominal GDP per capita (dollars, quarterly SAAR).
 *
 * @see https://fred.stlouisfed.org/series/A939RC0Q052SBEA
 */
const FRED_GDP_PER_CAPITA_CSV_URL = "https://fred.stlouisfed.org/graph/fredgraph.csv?id=A939RC0Q052SBEA";

/**
 * FRED Total Public Debt as Percent of GDP (quarterly).
 *
 * @see https://fred.stlouisfed.org/series/GFDEGDQ188S
 */
const FRED_DEBT_PCT_GDP_CSV_URL = "https://fred.stlouisfed.org/graph/fredgraph.csv?id=GFDEGDQ188S";

function fredUserAgent(): string {
  const fromEnv = process.env.SEC_EDGAR_USER_AGENT?.trim();
  return fromEnv || "FinsepaMacro/1.0 (+https://finsepa.com)";
}

function parseFredCsvIndex(text: string): FredGdpMacroPoint[] {
  const lines = text.split(/\r?\n/);
  const out: FredGdpMacroPoint[] = [];
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

function parseFredGdpCsv(text: string): FredGdpMacroPoint[] {
  return parseFredCsvIndex(text).map((p) => ({
    time: p.time,
    // FRED publishes billions; Macro `usd` format expects full dollar amounts.
    value: p.value * 1e9,
  }));
}

/** Four quarters earlier (same calendar quarter). */
function priorYearQuarter(ymd: string): string {
  const y = Number(ymd.slice(0, 4));
  const rest = ymd.slice(4);
  return `${y - 1}${rest}`;
}

function yoyFromIndex(index: FredGdpMacroPoint[]): FredGdpMacroPoint[] {
  const byDate = new Map(index.map((p) => [p.time, p.value]));
  const out: FredGdpMacroPoint[] = [];
  for (const p of index) {
    const prior = byDate.get(priorYearQuarter(p.time));
    if (prior == null || prior <= 0) continue;
    const rate = (p.value / prior - 1) * 100;
    if (!Number.isFinite(rate)) continue;
    out.push({ time: p.time, value: Math.round(rate * 100) / 100 });
  }
  return out;
}

async function fetchFredCsv(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": fredUserAgent(), Accept: "text/csv,*/*" },
      next: { revalidate: REVALIDATE_STATIC_DAY },
    });
    if (!res.ok) return null;
    const text = await res.text();
    if (!text.trim() || text.trimStart().startsWith("<!")) return null;
    return text;
  } catch {
    return null;
  }
}

async function fetchFredGdpUncached(): Promise<FredGdpMacroPoint[]> {
  const text = await fetchFredCsv(FRED_GDP_CSV_URL);
  if (!text) return [];
  return parseFredGdpCsv(text);
}

async function fetchFredGdpGrowthYoyUncached(): Promise<FredGdpMacroPoint[]> {
  const text = await fetchFredCsv(FRED_GDPC1_CSV_URL);
  if (!text) return [];
  return yoyFromIndex(parseFredCsvIndex(text));
}

async function fetchFredGdpPerCapitaUncached(): Promise<FredGdpMacroPoint[]> {
  const text = await fetchFredCsv(FRED_GDP_PER_CAPITA_CSV_URL);
  if (!text) return [];
  return parseFredCsvIndex(text);
}

async function fetchFredDebtPctGdpUncached(): Promise<FredGdpMacroPoint[]> {
  const text = await fetchFredCsv(FRED_DEBT_PCT_GDP_CSV_URL);
  if (!text) return [];
  return parseFredCsvIndex(text);
}

export const fetchFredGdpSeriesCached = unstable_cache(fetchFredGdpUncached, ["fred-gdp-nominal-v1"], {
  revalidate: REVALIDATE_STATIC_DAY,
});

export const fetchFredGdpGrowthYoySeriesCached = unstable_cache(
  fetchFredGdpGrowthYoyUncached,
  ["fred-gdpc1-yoy-v1"],
  { revalidate: REVALIDATE_STATIC_DAY },
);

export const fetchFredGdpPerCapitaSeriesCached = unstable_cache(
  fetchFredGdpPerCapitaUncached,
  ["fred-gdp-per-capita-v1"],
  { revalidate: REVALIDATE_STATIC_DAY },
);

export const fetchFredDebtPctGdpSeriesCached = unstable_cache(
  fetchFredDebtPctGdpUncached,
  ["fred-debt-pct-gdp-v1"],
  { revalidate: REVALIDATE_STATIC_DAY },
);
