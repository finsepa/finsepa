import { NextResponse } from "next/server";

import { refreshAllSuperinvestor13fPortfolios } from "@/lib/superinvestors/load-superinvestor-profile-data";
import { pickProcessEnv } from "@/lib/env/pick-process-env";

export const runtime = "nodejs";
export const maxDuration = 300;

function authorizeCron(request: Request): boolean {
  const secret = pickProcessEnv("CRON_SECRET");
  if (!secret) return false;
  const auth = request.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

/**
 * Probes SEC for new 13F-HR accessions and warms portfolio caches (Dataroma-style).
 * Schedule daily during filing season; cheap when nothing new (cached snapshots).
 */
export async function GET(request: Request) {
  if (!authorizeCron(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const results = await refreshAllSuperinvestor13fPortfolios();
    return NextResponse.json({ at: new Date().toISOString(), results });
  } catch (e) {
    const message = e instanceof Error ? e.message : "refresh_failed";
    console.error("[cron/superinvestor-13f]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  return GET(request);
}
