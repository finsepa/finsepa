import { NextResponse } from "next/server";

import { getAllCryptoLiveQuotes } from "@/lib/market/crypto-live-quotes";
import { cryptoLiveQuotesToPayload } from "@/lib/market/crypto-live-quotes-shared";

/**
 * Every exchange-covered crypto quote in one response. No user data and one fixed URL, so the
 * CDN serves all viewers from a single cached copy. `s-maxage` matches the 10s client poll
 * (`CRYPTO_LIVE_QUOTES_POLL_MS`) — shorter only re-runs the function for no fresher UI.
 */
export async function GET() {
  const { quotes, asOfSec } = await getAllCryptoLiveQuotes();
  return NextResponse.json(cryptoLiveQuotesToPayload(quotes, asOfSec), {
    headers: { "Cache-Control": "public, max-age=0, s-maxage=10, stale-while-revalidate=30" },
  });
}
