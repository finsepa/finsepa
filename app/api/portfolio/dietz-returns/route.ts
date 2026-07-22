import { NextResponse } from "next/server";

import {
  computePortfolioDietzPeriods,
  parseDietzReturnsBody,
} from "@/lib/portfolio/returns/portfolio-dietz-periods.server";
import { requireAuthUser, AuthRequiredError } from "@/lib/watchlist/api-auth";
import { getSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Modified Dietz period returns for Manual Portfolio overview cards / diagnostics.
 * Body: { transactions, periods?: DietzPeriodKey[] }
 */
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

    const parsed = parseDietzReturnsBody(body);
    if (!parsed) {
      return NextResponse.json({ error: "Invalid body" }, { status: 400 });
    }

    const periods = await computePortfolioDietzPeriods(parsed.transactions, parsed.periods);
    return NextResponse.json(
      { periods },
      {
        headers: {
          "Cache-Control": "private, no-store",
        },
      },
    );
  } catch (e) {
    if (e instanceof AuthRequiredError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const message = e instanceof Error ? e.message : "Server error";
    console.error("[portfolio dietz-returns]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
