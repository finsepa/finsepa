import { NextResponse } from "next/server";

import { readUsQuotesBulkMap, usQuotesBulkKey } from "@/lib/market/us-quotes-bulk";
import type { SearchDirectoryQuote } from "@/lib/search/search-directory-types";

const MAX_SYMBOLS = 50;

/**
 * Last price / 1D for US search hits outside the browse directory, from the cron bulk list
 * (one Supabase row, cached in-process) — no EODHD. OTC names the bulk feed lacks are omitted.
 */
export async function GET(request: Request) {
  const raw = new URL(request.url).searchParams.get("symbols") ?? "";
  const symbols = [...new Set(raw.split(",").map((s) => s.trim().toUpperCase()).filter(Boolean))].slice(
    0,
    MAX_SYMBOLS,
  );

  const quotes: Record<string, SearchDirectoryQuote> = {};
  const bulk = symbols.length ? await readUsQuotesBulkMap() : null;
  for (const symbol of symbols) {
    const q = bulk?.get(usQuotesBulkKey(symbol));
    if (q) quotes[symbol] = { price: q.price, changePct: q.changePct, marketCapUsd: null };
  }

  return NextResponse.json(
    { quotes },
    { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } },
  );
}
