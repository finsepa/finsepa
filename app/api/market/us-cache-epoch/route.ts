import { NextResponse } from "next/server";

import { getScreenerUsMarketCacheEpoch } from "@/lib/screener/screener-us-market-cache";

/** Shared US equity market cache segment (live 15m slot or frozen session) — no auth, same for all users. */
export async function GET() {
  const epoch = getScreenerUsMarketCacheEpoch();
  return NextResponse.json({ segment: epoch.segment, mode: epoch.mode });
}
