import { NextResponse } from "next/server";

import { CACHE_CONTROL_PRIVATE_DIVIDENDS_SCHEDULE } from "@/lib/data/cache-policy";
import { buildPortfolioDividendsSchedule } from "@/lib/portfolio/portfolio-dividends-schedule-server";
import { requireAuthUser, AuthRequiredError } from "@/lib/watchlist/api-auth";
import { getSupabaseServerClient } from "@/lib/supabase/server";

type Body = {
  holdings?: unknown;
};

export async function POST(request: Request) {
  try {
    const supabase = await getSupabaseServerClient();
    await requireAuthUser(supabase);

    let body: Body;
    try {
      body = (await request.json()) as Body;
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const raw = Array.isArray(body.holdings) ? body.holdings : [];
    const holdings = raw
      .map((h) => {
        if (!h || typeof h !== "object") return null;
        const o = h as Record<string, unknown>;
        const symbol = typeof o.symbol === "string" ? o.symbol.trim() : "";
        const shares = typeof o.shares === "number" ? o.shares : Number(o.shares);
        if (!symbol || !Number.isFinite(shares)) return null;
        return { symbol, shares };
      })
      .filter(Boolean) as { symbol: string; shares: number }[];

    const payload = await buildPortfolioDividendsSchedule(holdings);

    return NextResponse.json(payload, {
      headers: { "Cache-Control": CACHE_CONTROL_PRIVATE_DIVIDENDS_SCHEDULE },
    });
  } catch (e) {
    if (e instanceof AuthRequiredError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const message = e instanceof Error ? e.message : "Server error";
    console.error("[portfolio dividends-schedule]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
