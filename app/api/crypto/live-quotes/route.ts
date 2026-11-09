import { NextResponse } from "next/server";

import { getAllCryptoLiveQuotes } from "@/lib/market/crypto-live-quotes";
import { cryptoLiveQuotesToPayload } from "@/lib/market/crypto-live-quotes-shared";

/**
 * Every exchange-covered crypto quote in one response. No user data and one fixed URL, so the
 * CDN serves all viewers from a single cached copy (~1 function call per 5s per region).
 */
export async function GET() {
  const { quotes, asOfSec } = await getAllCryptoLiveQuotes();
  return NextResponse.json(cryptoLiveQuotesToPayload(quotes, asOfSec), {
    headers: { "Cache-Control": "public, max-age=0, s-maxage=5, stale-while-revalidate=30" },
  });
}
