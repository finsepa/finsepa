import { NextResponse } from "next/server";

import { unstable_cache } from "next/cache";

import { CACHE_CONTROL_PRIVATE_SCREENER_ROW } from "@/lib/data/cache-policy";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { fetchScreenerKeyStatCellsBatch } from "@/lib/screener/fetch-screener-key-stat-cells-batch";
import { parseScreenerCompaniesKeyStatRequest } from "@/lib/screener/screener-companies-key-stat-request";

const getCachedKeyStatBatch = unstable_cache(
  async (metricIdsKey: string, tickersKey: string) => {
    const metricIds = metricIdsKey ? metricIdsKey.split(",").filter(Boolean) : [];
    const tickers = tickersKey ? tickersKey.split(",").filter(Boolean) : [];
    const parsed = parseScreenerCompaniesKeyStatRequest({ tickers, metricIds });
    if (!parsed.ok || parsed.parsed.mode !== "batch") {
      return {} as Record<string, Record<string, string>>;
    }
    return fetchScreenerKeyStatCellsBatch(parsed.parsed.tickers, parsed.parsed.metrics);
  },
  ["screener-companies-key-stat-batch-v1"],
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

  const parsed = parseScreenerCompaniesKeyStatRequest(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: parsed.status });
  }

  const cacheHeaders = { "Cache-Control": CACHE_CONTROL_PRIVATE_SCREENER_ROW };

  if (!parsed.parsed.tickers.length) {
    if (parsed.parsed.mode === "batch") {
      return NextResponse.json({ valuesByMetric: {}, metricIds: parsed.parsed.metricIds }, { headers: cacheHeaders });
    }
    return NextResponse.json({ values: {} satisfies Record<string, string> }, { headers: cacheHeaders });
  }

  if (parsed.parsed.mode === "legacy") {
    const { metric, tickers } = parsed.parsed;
    const tickersKey = [...tickers].sort().join(",");
    const valuesByMetric = await getCachedKeyStatBatch(metric.id, tickersKey);
    const values = valuesByMetric[metric.id] ?? {};
    return NextResponse.json(
      { values, metricId: metric.id, label: metric.label, section: metric.section },
      { headers: cacheHeaders },
    );
  }

  const { tickers, metricIds, metrics } = parsed.parsed;
  const tickersKey = [...tickers].sort().join(",");
  const metricIdsKey = metricIds.join(",");
  const valuesByMetric = await getCachedKeyStatBatch(metricIdsKey, tickersKey);

  // Ensure every requested metric id is present in the payload.
  const normalized: Record<string, Record<string, string>> = {};
  for (const metric of metrics) {
    normalized[metric.id] = valuesByMetric[metric.id] ?? {};
  }

  return NextResponse.json({ valuesByMetric: normalized, metricIds }, { headers: cacheHeaders });
}
