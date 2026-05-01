import "server-only";

import { unstable_cache } from "next/cache";

import { REVALIDATE_WARM } from "@/lib/data/cache-policy";
import { getEodhdApiKey } from "@/lib/env/server";
import { fetchEodhdEconomicEventsAll } from "@/lib/market/eodhd-economic-events";

/** Same shape as {@link MacroPoint} in `eodhd-macro` — avoids importing that module here. */
export type FedFundsMacroPoint = { time: string; value: number };

function isFedFundsEventType(type: string | undefined): boolean {
  if (!type) return false;
  return type.toLowerCase().includes("fed interest rate");
}

/**
 * Federal funds **target** after each FOMC decision (`actual` on EODHD economic-events rows).
 * Macro `interest_rate` is annual World Bank “central bank rate” and does not track the current Fed target.
 *
 * @see https://eodhd.com/financial-apis/economic-events-data-api
 */
async function fetchFedFundsTargetUncached(): Promise<FedFundsMacroPoint[]> {
  if (!getEodhdApiKey()) return [];

  const startYear = 2020;
  const endYear = new Date().getUTCFullYear();
  const today = new Date().toISOString().slice(0, 10);

  const tmp: { day: string; value: number; sortKey: string }[] = [];

  for (let y = startYear; y <= endYear; y++) {
    const from = `${y}-01-01`;
    const to = y === endYear ? today : `${y}-12-31`;
    const rows = await fetchEodhdEconomicEventsAll(from, to, "US");
    for (const r of rows) {
      if (!isFedFundsEventType(r.type)) continue;
      if (r.actual == null || !Number.isFinite(r.actual)) continue;
      if (!r.date?.trim()) continue;
      const sortKey = r.date.trim();
      const day = sortKey.slice(0, 10);
      if (day.length < 10) continue;
      tmp.push({ day, value: r.actual, sortKey });
    }
  }

  tmp.sort((a, b) => a.sortKey.localeCompare(b.sortKey));

  const byDay = new Map<string, FedFundsMacroPoint>();
  for (const t of tmp) {
    byDay.set(t.day, { time: t.day, value: t.value });
  }

  return Array.from(byDay.values()).sort((a, b) => a.time.localeCompare(b.time));
}

export const fetchFedFundsTargetSeriesCached = unstable_cache(fetchFedFundsTargetUncached, ["eodhd-fed-funds-fomc-v1"], {
  revalidate: REVALIDATE_WARM,
});
