import { NextResponse } from "next/server";

import { warmStockKeyIndicators, stockKeyIndicatorsEnabled } from "@/lib/market/stock-key-indicators-service";
import { getTop500Universe } from "@/lib/screener/top500-companies";
import { pickProcessEnv } from "@/lib/env/pick-process-env";

export const runtime = "nodejs";
export const maxDuration = 300;

const SHARDS = 4;

function authorizeCron(request: Request): boolean {
  const secret = pickProcessEnv("CRON_SECRET");
  if (!secret) return false;
  const auth = request.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

function parseShard(request: Request): number {
  const raw = new URL(request.url).searchParams.get("shard");
  const n = raw == null || raw === "" ? 0 : Number(raw);
  return Number.isFinite(n) ? Math.max(0, Math.min(SHARDS - 1, Math.floor(n))) : 0;
}

export async function GET(request: Request) {
  if (!authorizeCron(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  if (!stockKeyIndicatorsEnabled()) {
    return NextResponse.json({ ok: true, skipped: "FINSEPA_KEY_INDICATORS!=1" });
  }

  const shard = parseShard(request);
  const universe = await getTop500Universe();
  const tickers = universe
    .map((r) => r.ticker.trim().toUpperCase())
    .filter((t, i, arr) => t && arr.indexOf(t) === i)
    .filter((_, i) => i % SHARDS === shard);

  let warmed = 0;
  let failed = 0;

  for (const ticker of tickers) {
    const result = await warmStockKeyIndicators(ticker);
    if (result.ok) warmed += 1;
    else failed += 1;
  }

  return NextResponse.json({
    at: new Date().toISOString(),
    shard,
    shards: SHARDS,
    tickers: tickers.length,
    warmed,
    failed,
  });
}

export async function POST(request: Request) {
  return GET(request);
}
