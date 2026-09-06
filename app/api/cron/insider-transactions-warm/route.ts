import { NextResponse } from "next/server";

import { warmInsiderTransactionsSnapshot } from "@/lib/market/insider-transactions-load";
import { pickProcessEnv } from "@/lib/env/pick-process-env";
import { TOP10_TICKERS } from "@/lib/screener/top10-config";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * Weekday Form 4 warm for TOP10 — durable `insider_form4_1y_*` snapshots.
 * Skips when a snapshot is < ~20h old. ~10 tickers × ≤4 pages × 10 credits when stale.
 */

function authorizeCron(request: Request): boolean {
  const secret = pickProcessEnv("CRON_SECRET");
  if (!secret) return false;
  const auth = request.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

/** Mon–Fri only (UTC). Weekend hits return skipped. */
function isWeekdayUtc(now = new Date()): boolean {
  const day = now.getUTCDay(); // 0 Sun … 6 Sat
  return day >= 1 && day <= 5;
}

export async function GET(request: Request) {
  if (!authorizeCron(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  if (!isWeekdayUtc()) {
    return NextResponse.json({
      ok: true,
      skipped: "weekend",
      at: new Date().toISOString(),
    });
  }

  const tickers = [...TOP10_TICKERS];
  let warmed = 0;
  let skippedFresh = 0;
  let failed = 0;
  const rowCounts: Record<string, number> = {};

  for (const ticker of tickers) {
    try {
      const result = await warmInsiderTransactionsSnapshot(ticker);
      rowCounts[ticker] = result.rowCount;
      if (result.skippedFresh) skippedFresh += 1;
      else if (result.ok) warmed += 1;
      else failed += 1;
    } catch {
      failed += 1;
    }
  }

  return NextResponse.json({
    at: new Date().toISOString(),
    tickers: tickers.length,
    warmed,
    skippedFresh,
    failed,
    rowCounts,
  });
}

export async function POST(request: Request) {
  return GET(request);
}
