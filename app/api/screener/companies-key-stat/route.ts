import { NextResponse } from "next/server";

import { unstable_cache } from "next/cache";

import { CACHE_CONTROL_PRIVATE_SCREENER_ROW } from "@/lib/data/cache-policy";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { fetchKeyStatCellForTicker } from "@/lib/screener/fetch-screener-key-stat-cell";
import { getScreenerKeyStatMetricById } from "@/lib/screener/screener-key-stats-metric-catalog";

const MAX_TICKERS = 20;
const CHUNK_SIZE = 6;

const getCachedKeyStatCells = unstable_cache(
  async (metricId: string, tickersKey: string) => {
    const metric = getScreenerKeyStatMetricById(metricId);
    if (!metric) return { metric: null as typeof metric | null, values: {} as Record<string, string> };
    const tickers = tickersKey ? tickersKey.split(",").filter(Boolean) : [];
    const values: Record<string, string> = {};
    for (let i = 0; i < tickers.length; i += CHUNK_SIZE) {
      const chunk = tickers.slice(i, i + CHUNK_SIZE);
      const chunkResults = await Promise.all(
        chunk.map(async (ticker) => {
          const value = await fetchKeyStatCellForTicker(ticker, metric.section, metric.label);
          return { ticker, value };
        }),
      );
      for (const { ticker, value } of chunkResults) {
        values[ticker] = value;
      }
    }
    return { metric, values };
  },
  ["screener-companies-key-stat-v1"],
  // Key-stat cells are fundamentals-derived; cache long to prevent spikes.
  { revalidate: 12 * 60 * 60 },
);

export async function POST(request: Request) {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const tickersRaw = body && typeof body === "object" && "tickers" in body ? (body as { tickers?: unknown }).tickers : null;
  const metricIdRaw =
    body && typeof body === "object" && "metricId" in body ? (body as { metricId?: unknown }).metricId : null;

  if (typeof metricIdRaw !== "string" || !metricIdRaw.trim()) {
    return NextResponse.json({ error: "metricId required" }, { status: 400 });
  }

  const metric = getScreenerKeyStatMetricById(metricIdRaw.trim());
  if (!metric) {
    return NextResponse.json({ error: "Unknown metricId" }, { status: 400 });
  }

  if (!Array.isArray(tickersRaw)) {
    return NextResponse.json({ error: "tickers must be an array" }, { status: 400 });
  }

  const tickers = tickersRaw
    .filter((t): t is string => typeof t === "string" && t.trim().length > 0)
    .map((t) => t.trim().toUpperCase())
    .slice(0, MAX_TICKERS);

  if (!tickers.length) {
    return NextResponse.json({ values: {} satisfies Record<string, string> }, { headers: { "Cache-Control": CACHE_CONTROL_PRIVATE_SCREENER_ROW } });
  }

  const tickersKey = [...new Set(tickers)].sort().join(",");
  const cached = await getCachedKeyStatCells(metric.id, tickersKey);
  const values = cached.values;

  return NextResponse.json(
    { values, metricId: metric.id, label: metric.label, section: metric.section },
    { headers: { "Cache-Control": CACHE_CONTROL_PRIVATE_SCREENER_ROW } },
  );
}
