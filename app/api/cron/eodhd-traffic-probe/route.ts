import { NextResponse } from "next/server";

import { runEodhdTrafficProbe } from "@/lib/market/eodhd-traffic-probe";
import { runScreenerFanoutProbe } from "@/lib/screener/screener-fanout-probe";
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

  const url = new URL(request.url);
  const runCronIngest = url.searchParams.get("ingest") === "1";
  const ticker = url.searchParams.get("ticker")?.trim() || "AAPL";
  const fanoutRaw = url.searchParams.get("fanout");

  try {
    if (fanoutRaw != null && fanoutRaw !== "") {
      const users = Number(fanoutRaw) || 100;
      const report = await runScreenerFanoutProbe({ users });
      return NextResponse.json(report, { status: report.pass ? 200 : 409 });
    }

    const report = await runEodhdTrafficProbe({ ticker, runCronIngest });
    return NextResponse.json(report);
  } catch (e) {
    const message = e instanceof Error ? e.message : "probe_failed";
    console.error("[cron/eodhd-traffic-probe]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  return GET(request);
}
