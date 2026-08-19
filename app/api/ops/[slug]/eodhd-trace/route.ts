import { NextResponse } from "next/server";

import { adminHealthSlugMatches, hasValidAdminHealthSession } from "@/lib/admin-health/auth";
import { isAdminHealthConfigured } from "@/lib/admin-health/env";
import { peekEodhdRequestWindow } from "@/lib/market/eodhd-hourly-budget";
import { runEodhdTrafficProbe } from "@/lib/market/eodhd-traffic-probe";
import { PROVIDER_TRACE_ENABLED } from "@/lib/market/provider-trace";
import type {
  EodhdTraceBudgetResponse,
  EodhdTraceProbeResponse,
} from "@/lib/admin-health/eodhd-trace-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

type Ctx = { params: Promise<{ slug: string }> };

export type { EodhdTraceBudgetResponse, EodhdTraceProbeResponse } from "@/lib/admin-health/eodhd-trace-types";

async function authorizeOps(slug: string): Promise<boolean> {
  if (!isAdminHealthConfigured()) return false;
  if (!adminHealthSlugMatches(slug)) return false;
  return hasValidAdminHealthSession(slug);
}

export async function GET(request: Request, { params }: Ctx) {
  const { slug } = await params;
  if (!(await authorizeOps(slug))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const mode = url.searchParams.get("mode") ?? "budget";

  if (mode === "budget") {
    const body: EodhdTraceBudgetResponse = {
      mode: "budget",
      at: new Date().toISOString(),
      budget: peekEodhdRequestWindow(),
      providerTraceEnabled: PROVIDER_TRACE_ENABLED,
    };
    return NextResponse.json(body);
  }

  if (mode !== "probe") {
    return NextResponse.json({ error: "invalid_mode" }, { status: 400 });
  }

  const ticker = url.searchParams.get("ticker")?.trim() || "AAPL";
  const runCronIngest = url.searchParams.get("ingest") === "1";

  try {
    const report = await runEodhdTrafficProbe({ ticker, runCronIngest });
    const body: EodhdTraceProbeResponse = { mode: "probe", ...report };
    return NextResponse.json(body);
  } catch (e) {
    const message = e instanceof Error ? e.message : "probe_failed";
    console.error("[ops/eodhd-trace]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
