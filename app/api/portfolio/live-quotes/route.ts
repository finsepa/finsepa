import { NextResponse } from "next/server";

import { CACHE_CONTROL_PRIVATE_NO_STORE } from "@/lib/data/cache-policy";
import { fetchPortfolioLivePricesUsdCached } from "@/lib/portfolio/portfolio-live-quotes-server";
import { requireAuthUser, AuthRequiredError } from "@/lib/watchlist/api-auth";
import { getSupabaseServerClient } from "@/lib/supabase/server";

type Body = { symbols?: unknown };

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

    const raw = Array.isArray(body.symbols) ? body.symbols.filter((s): s is string => typeof s === "string") : [];
    const symbols = [...new Set(raw.map((s) => s.trim().toUpperCase()).filter(Boolean))];

    const prices = await fetchPortfolioLivePricesUsdCached(symbols);

    return NextResponse.json(
      { prices },
      { headers: { "Cache-Control": CACHE_CONTROL_PRIVATE_NO_STORE } },
    );
  } catch (e) {
    if (e instanceof AuthRequiredError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const message = e instanceof Error ? e.message : "Server error";
    console.error("[portfolio live-quotes]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
