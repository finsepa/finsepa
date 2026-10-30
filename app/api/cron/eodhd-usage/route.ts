import { NextResponse } from "next/server";

import { getEodhdApiKey } from "@/lib/env/server";
import { pickProcessEnv } from "@/lib/env/pick-process-env";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

function authorizeCron(request: Request): boolean {
  const secret = pickProcessEnv("CRON_SECRET");
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

function toInt(v: unknown): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

/** Records today's EODHD credit usage (`/api/user`, no credit cost) before the midnight-UTC reset. */
export async function GET(request: Request) {
  if (!authorizeCron(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const key = getEodhdApiKey();
  const admin = getSupabaseAdminClient();
  if (!key || !admin) {
    return NextResponse.json({ error: "missing_eodhd_key_or_supabase_admin" }, { status: 500 });
  }

  const res = await fetch(`https://eodhd.com/api/user?api_token=${encodeURIComponent(key)}&fmt=json`, {
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    return NextResponse.json({ error: `eodhd_user_http_${res.status}` }, { status: 502 });
  }
  const user = (await res.json()) as Record<string, unknown>;
  const apiRequests = toInt(user.apiRequests);
  if (apiRequests == null) {
    return NextResponse.json({ error: "eodhd_user_missing_apiRequests" }, { status: 502 });
  }

  const now = new Date();
  const row = {
    usage_date: now.toISOString().slice(0, 10),
    api_requests: apiRequests,
    daily_rate_limit: toInt(user.dailyRateLimit),
    extra_limit: toInt(user.extraLimit),
    recorded_at: now.toISOString(),
  };
  const { error } = await admin.from("eodhd_usage_daily").upsert(row, { onConflict: "usage_date" });
  if (error) {
    console.error("[cron/eodhd-usage]", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  console.info(`[cron/eodhd-usage] ${row.usage_date} api_requests=${apiRequests} extra_limit=${row.extra_limit}`);
  return NextResponse.json(row);
}
