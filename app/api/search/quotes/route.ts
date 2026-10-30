import { NextResponse } from "next/server";

import { readUsEquityMcapMapCached } from "@/lib/market/us-equity-mcap-universe";
import { readUsQuotesBulkMap, usQuotesBulkKey } from "@/lib/market/us-quotes-bulk";
import type { SearchDirectoryQuote } from "@/lib/search/search-directory-types";

const MAX_SYMBOLS = 50;

/**
 * Last price / 1D (cron bulk list) and market cap (daily US equity mcap snapshot) for US search hits
 * outside the browse directory — Supabase reads only, no EODHD. Symbols in neither source are omitted.
 */
export async function GET(request: Request) {
  const raw = new URL(request.url).searchParams.get("symbols") ?? "";
  const symbols = [...new Set(raw.split(",").map((s) => s.trim().toUpperCase()).filter(Boolean))].slice(
    0,
    MAX_SYMBOLS,
  );

  const quotes: Record<string, SearchDirectoryQuote> = {};
  const [bulk, mcap] = symbols.length
    ? await Promise.all([readUsQuotesBulkMap(), readUsEquityMcapMapCached()])
    : [null, null];
  for (const symbol of symbols) {
    const q = bulk?.get(usQuotesBulkKey(symbol));
    const marketCapUsd = mcap?.get(symbol.replace(/-/g, "."))?.marketCapUsd ?? null;
    if (!q && marketCapUsd == null) continue;
    quotes[symbol] = { price: q?.price ?? null, changePct: q?.changePct ?? null, marketCapUsd };
  }

  return NextResponse.json(
    { quotes },
    { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } },
  );
}
