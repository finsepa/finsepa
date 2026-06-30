import { NextResponse } from "next/server";

import { pickProcessEnv } from "@/lib/env/pick-process-env";
import {
  enqueueWatchlistStockSessionTickBackfills,
  lastCompletedUsRegularSessionYmd,
  processStockSessionTickBackfillBatch,
  stockSessionTickBackfillEnabled,
} from "@/lib/market/stock-session-tick-backfill";

export const runtime = "nodejs";
export const maxDuration = 300;

function authorizeCron(request: Request): boolean {
  const secret = pickProcessEnv("CRON_SECRET");
  if (!secret) return false;
  const auth = request.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

export async function GET(request: Request) {
  if (!authorizeCron(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  if (!stockSessionTickBackfillEnabled()) {
    return NextResponse.json({ ok: true, skipped: "FINSEPA_STOCK_TICK_BACKFILL=0" });
  }

  try {
    const url = new URL(request.url);
    const sessionYmd = url.searchParams.get("sessionYmd") ?? lastCompletedUsRegularSessionYmd();
    const enqueued = await enqueueWatchlistStockSessionTickBackfills(sessionYmd);
    const batch = await processStockSessionTickBackfillBatch();

    return NextResponse.json({
      at: new Date().toISOString(),
      sessionYmd,
      enqueued,
      processed: batch.processed,
      results: batch.results,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "backfill_failed";
    console.error("[cron/stock-minute-bar-backfill]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  return GET(request);
}
