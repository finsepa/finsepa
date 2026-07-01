import { NextResponse } from "next/server";

import { warmEarningsDocumentCacheBatch } from "@/lib/market/earnings-document-cache-warm";
import { pickProcessEnv } from "@/lib/env/pick-process-env";

export const runtime = "nodejs";
export const maxDuration = 300;

function authorizeCron(request: Request): boolean {
  const secret = pickProcessEnv("CRON_SECRET");
  if (!secret) return false;
  const auth = request.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

function parseShard(request: Request): number | undefined {
  const raw = new URL(request.url).searchParams.get("shard");
  if (raw == null || raw === "") return undefined;
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
}

export async function GET(request: Request) {
  if (!authorizeCron(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const shard = parseShard(request);
    const result = await warmEarningsDocumentCacheBatch({ shard });
    return NextResponse.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : "warm_failed";
    console.error("[cron/earnings-document-cache-warm]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  return GET(request);
}
