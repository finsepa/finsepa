import "server-only";

import { unstable_cache } from "next/cache";

import { REVALIDATE_EARNINGS_CALENDAR } from "@/lib/data/cache-policy";
import { fetchEodhdEconomicEventsAll } from "@/lib/market/eodhd-economic-events";

export type EconomyEventHistoryPoint = {
  date: string;
  period: string | null;
  actual: number | null;
  estimate: number | null;
  previous: number | null;
};

function fmtYmd(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

async function loadEconomyEventHistoryPointsUncached(
  eventType: string,
  country: string,
  comparison: string | null,
): Promise<EconomyEventHistoryPoint[]> {
  const now = new Date();
  const toDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const fromDate = new Date(toDate);
  fromDate.setUTCFullYear(fromDate.getUTCFullYear() - 5);

  const raw = await fetchEodhdEconomicEventsAll(fmtYmd(fromDate), fmtYmd(toDate), country);
  const normalizedComparison = (comparison ?? "").toLowerCase().trim();

  return raw
    .filter((r) => {
      if (!r.type || r.type.trim() !== eventType) return false;
      const rc = (r.comparison ?? "").toLowerCase().trim();
      if (normalizedComparison && rc !== normalizedComparison) return false;
      if (!normalizedComparison && rc) return false;
      return r.actual != null || r.previous != null || r.estimate != null;
    })
    .map((r) => ({
      date: r.date ?? "",
      period: r.period ?? null,
      actual: r.actual ?? null,
      estimate: r.estimate ?? null,
      previous: r.previous ?? null,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

const loadEconomyEventHistoryPointsCached = unstable_cache(
  loadEconomyEventHistoryPointsUncached,
  ["economy-event-history-v1"],
  { revalidate: REVALIDATE_EARNINGS_CALENDAR },
);

/** Five-year macro history for one indicator — shared across users (24h revalidate). */
export async function fetchEconomyEventHistoryPoints(
  eventType: string,
  country: string,
  comparison: string | null,
): Promise<EconomyEventHistoryPoint[]> {
  const type = eventType.trim();
  const cc = country.trim().toUpperCase() || "US";
  const cmp = comparison?.trim() ? comparison.trim() : "";
  return loadEconomyEventHistoryPointsCached(type, cc, cmp || null);
}
