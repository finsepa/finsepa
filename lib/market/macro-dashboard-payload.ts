import "server-only";

import { unstable_cache } from "next/cache";

import { REVALIDATE_WARM } from "@/lib/data/cache-policy";
import { fetchMacroSeries5y, MACRO_SERIES, type MacroSeriesDef } from "@/lib/market/eodhd-macro";

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
      const points = await fetchMacroSeries5y(country, def);
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
 * Single cached blob for `/api/macro` — avoids recomputing N series on every navigation after cold fill.
 */
export const getMacroDashboardPayloadCached = unstable_cache(
  buildMacroDashboardPayloadUncached,
  ["macro-dashboard-payload-v2"],
  { revalidate: REVALIDATE_WARM },
);
