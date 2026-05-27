import { NextResponse } from "next/server";

import { ingestHubSnapshots } from "@/lib/market/hub-snapshot-ingest";
import { ingestMarketSnapshots } from "@/lib/market/market-snapshot-ingest";
import { pickProcessEnv } from "@/lib/env/pick-process-env";

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

  try {
    const [market, hub] = await Promise.all([ingestMarketSnapshots(), ingestHubSnapshots()]);
    return NextResponse.json({ market, hub });
  } catch (e) {
    const message = e instanceof Error ? e.message : "ingest_failed";
    console.error("[cron/market-snapshots]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  return GET(request);
}
