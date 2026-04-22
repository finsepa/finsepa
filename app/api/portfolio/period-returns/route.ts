import { NextResponse } from "next/server";

import { CACHE_CONTROL_PRIVATE_S_MAXAGE_0_SWR_FAST } from "@/lib/data/cache-policy";
import {
  computePortfolioPeriodReturns,
  parsePortfolioPeriodReturnsBody,
} from "@/lib/portfolio/portfolio-period-returns.server";
import { requireAuthUser, AuthRequiredError } from "@/lib/watchlist/api-auth";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const supabase = await getSupabaseServerClient();
    await requireAuthUser(supabase);

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const parsed = parsePortfolioPeriodReturnsBody(body);
    if (!parsed) {
      return NextResponse.json({ error: "Invalid body" }, { status: 400 });
    }

    const bars = await computePortfolioPeriodReturns(
      parsed.transactions,
      parsed.granularity,
      parsed.benchmark,
    );

    return NextResponse.json(
      { bars, benchmark: parsed.benchmark },
      {
        headers: {
          "Cache-Control": CACHE_CONTROL_PRIVATE_S_MAXAGE_0_SWR_FAST,
        },
      },
    );
  } catch (e) {
    if (e instanceof AuthRequiredError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const message = e instanceof Error ? e.message : "Server error";
    console.error("[portfolio period-returns]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
