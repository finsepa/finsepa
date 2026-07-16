import "server-only";

import { unstable_cache } from "next/cache";

import { REVALIDATE_STATIC_DAY } from "@/lib/data/cache-policy";
import { fetchBlsCpiURawSeriesCached } from "@/lib/market/bls-cpi-macro";
import { fetchShillerCpiSeriesCached } from "@/lib/market/shiller-ie-macro";

/** Same shape as {@link MacroPoint} in `eodhd-macro` — kept local to avoid import cycles. */
export type CpiInflationMacroPoint = { time: string; value: number };

function addMonthsYmd(ymd: string, delta: number): string {
  const y = Number(ymd.slice(0, 4));
  const m = Number(ymd.slice(5, 7));
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-01`;
}

/**
 * Shiller historic CPI + BLS CPI-U (SA); BLS wins on overlapping months.
 * Both use the 1982–84 = 100 scale.
 */
function mergeCpiHistory(
  shiller: CpiInflationMacroPoint[],
  bls: CpiInflationMacroPoint[],
): CpiInflationMacroPoint[] {
  const byMonth = new Map<string, number>();
  for (const p of shiller) byMonth.set(p.time, p.value);
  for (const p of bls) byMonth.set(p.time, p.value);
  return [...byMonth.entries()]
    .map(([time, value]) => ({ time, value }))
    .sort((a, b) => a.time.localeCompare(b.time));
}

/**
 * 12-month percent change in CPI — same definition as Multpl US Inflation Rate.
 *
 * @see https://www.multpl.com/inflation
 */
function yoyInflationFromCpi(cpi: CpiInflationMacroPoint[]): CpiInflationMacroPoint[] {
  const byMonth = new Map(cpi.map((p) => [p.time, p.value]));
  const out: CpiInflationMacroPoint[] = [];

  for (const p of cpi) {
    const prior = byMonth.get(addMonthsYmd(p.time, -12));
    if (prior == null || prior <= 0) continue;
    const rate = ((p.value / prior) - 1) * 100;
    if (!Number.isFinite(rate)) continue;
    out.push({ time: p.time, value: Math.round(rate * 100) / 100 });
  }

  return out;
}

async function fetchCpiYoyInflationUncached(): Promise<CpiInflationMacroPoint[]> {
  const [shiller, bls] = await Promise.all([fetchShillerCpiSeriesCached(), fetchBlsCpiURawSeriesCached()]);
  const merged = mergeCpiHistory(shiller, bls);
  return yoyInflationFromCpi(merged);
}

export const fetchCpiYoyInflationSeriesCached = unstable_cache(
  fetchCpiYoyInflationUncached,
  ["cpi-yoy-inflation-v2-shared-shiller-cpi"],
  { revalidate: REVALIDATE_STATIC_DAY },
);
