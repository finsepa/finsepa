import "server-only";

import { unstable_cache } from "next/cache";

import { REVALIDATE_STATIC_DAY } from "@/lib/data/cache-policy";
import { fetchMacroSeriesAll, MACRO_SERIES, type MacroSeriesDef } from "@/lib/market/eodhd-macro";

export type MacroDashboardCard = {
  id: string;
  title: string;
  kind: "percent" | "usd" | "index" | "number";
  points: Array<{ time: string; value: number }>;
  latest: { time: string; value: number } | null;
  change: { abs: number; pct: number | null } | null;
};

function latest(points: Array<{ time: string; value: number }>): { time: string; value: number } | null {
  if (!points.length) return null;
  return points[points.length - 1] ?? null;
}

async function buildMacroDashboardPayloadUncached(): Promise<{ country: string; items: MacroDashboardCard[] }> {
  const country = "USA";

  const settled = await Promise.allSettled(
    MACRO_SERIES.map(async (def: MacroSeriesDef): Promise<MacroDashboardCard | null> => {
      const points = await fetchMacroSeriesAll(country, def);
      if (!points.length) return null;
      const l = latest(points);
      if (!l) return null;
      const prev = points.length >= 2 ? points[points.length - 2]! : null;
      const abs = prev ? l.value - prev.value : null;
      const pct = prev && prev.value !== 0 ? (abs! / Math.abs(prev.value)) * 100 : null;
      return {
        id: def.id,
        title: def.title,
        kind: def.kind,
        points,
        latest: l,
        change: abs == null ? null : { abs, pct },
      };
    }),
  );

  const items: MacroDashboardCard[] = [];
  for (const s of settled) {
    if (s.status === "fulfilled" && s.value) items.push(s.value);
  }

  return { country, items };
}

/**
 * Single cached blob for `/macro` (RSC) and `/api/macro` — one `unstable_cache` entry shared across all users
 * until revalidation (~24h, same tier as macro indicator rows); matches Economy calendar-style cadence.
 */
export const getMacroDashboardPayloadCached = unstable_cache(
  buildMacroDashboardPayloadUncached,
  ["macro-dashboard-payload-v17"],
  { revalidate: REVALIDATE_STATIC_DAY },
);
