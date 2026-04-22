import { NextResponse } from "next/server";

import { CACHE_CONTROL_PRIVATE_S_MAXAGE_HOT_FAST, CACHE_CONTROL_PRIVATE_S_MAXAGE_WARM } from "@/lib/data/cache-policy";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { normalizeWatchlistTicker, WatchlistValidationError } from "@/lib/watchlist/operations";
import { getPeersCompareRowsCached } from "@/lib/market/peers-compare-payload";
import { isSingleAssetMode } from "@/lib/features/single-asset";

export async function POST(request: Request) {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as { tickers?: unknown };
  const raw = Array.isArray(body?.tickers) ? body!.tickers : [];

  const tickers: string[] = [];
  for (const t of raw) {
    if (typeof t !== "string") continue;
    try {
      tickers.push(normalizeWatchlistTicker(t));
    } catch (e) {
      if (e instanceof WatchlistValidationError) continue;
    }
  }

  const unique = Array.from(new Set(tickers)).sort().slice(0, 12);
  const tickersKey = unique.join("|");

  if (isSingleAssetMode()) {
    return NextResponse.json({ rows: [] }, { headers: { "Cache-Control": CACHE_CONTROL_PRIVATE_S_MAXAGE_HOT_FAST } });
  }

  const rows = await getPeersCompareRowsCached(tickersKey);

  return NextResponse.json(
    { rows },
    {
      headers: {
        "Cache-Control": CACHE_CONTROL_PRIVATE_S_MAXAGE_WARM,
      },
    },
  );
}

