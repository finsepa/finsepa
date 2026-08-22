import { NextResponse } from "next/server";

import { pickProcessEnv } from "@/lib/env/pick-process-env";
import { rebuildSuperinvestorPerformanceShard } from "@/lib/superinvestors/superinvestor-performance-series";
import { SUPERINVESTOR_PERFORMANCE_CRON_SLUGS } from "@/lib/superinvestors/superinvestor-performance-types";
import { withSuperinvestorSecRebuildAllowed } from "@/lib/superinvestors/superinvestor-sec-rebuild-gate";

export const runtime = "nodejs";
/** Cold rebuild: SEC walk + EOD bars per manager in shard (~5 slugs). */
export const maxDuration = 300;

function authorizeCron(request: Request): boolean {
  const secret = pickProcessEnv("CRON_SECRET");
  if (!secret) return false;
  const auth = request.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

function parseShardParam(raw: string | null, fallback: number): number {
  const n = Number.parseInt(raw ?? "", 10);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

function parseShardsParam(raw: string | null, fallback: number): number {
  const n = Number.parseInt(raw ?? "", 10);
  return Number.isFinite(n) && n >= 1 ? n : fallback;
}

/**
 * Daily performance warm (sharded). Query params:
 * - `shard` (0-based, default 0)
 * - `shards` (default 6 — matches vercel.json)
 */
export async function GET(request: Request) {
  if (!authorizeCron(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const url = new URL(request.url);
    const shards = parseShardsParam(url.searchParams.get("shards"), 6);
    const shard = parseShardParam(url.searchParams.get("shard"), 0);
    if (shard >= shards) {
      return NextResponse.json({ error: "shard_out_of_range", shard, shards }, { status: 400 });
    }

    const results = await withSuperinvestorSecRebuildAllowed(() =>
      rebuildSuperinvestorPerformanceShard({ shard, shards }),
    );

    const okCount = results.filter((r) => r.ok).length;
    const skippedCount = results.filter((r) => r.skipped).length;

    return NextResponse.json({
      at: new Date().toISOString(),
      shard,
      shards,
      managerCount: SUPERINVESTOR_PERFORMANCE_CRON_SLUGS.length,
      slugCount: results.length,
      okCount,
      skippedCount,
      results,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "performance_refresh_failed";
    console.error("[cron/superinvestor-performance]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  return GET(request);
}
