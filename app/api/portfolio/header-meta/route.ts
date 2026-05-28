import { NextResponse } from "next/server";

import { CACHE_CONTROL_PRIVATE_WARM_CHART } from "@/lib/data/cache-policy";
import { getStockHeaderIdentityForTicker } from "@/lib/market/stock-header-meta-server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { AuthRequiredError, requireAuthUser } from "@/lib/watchlist/api-auth";

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

    const entries = await Promise.all(
      symbols.map(async (sym) => {
        try {
          const meta = await getStockHeaderIdentityForTicker(sym);
          return [
            sym,
            {
              sector: meta.sector ?? null,
              industry: meta.industry ?? null,
            },
          ] as const;
        } catch {
          return [sym, { sector: null, industry: null }] as const;
        }
      }),
    );

    const bySymbol = Object.fromEntries(entries) as Record<string, { sector: string | null; industry: string | null }>;

    return NextResponse.json(
      { bySymbol },
      {
        // Sector/industry are slow-changing and cached server-side via unstable_cache (REVALIDATE_IDENTITY ~12h).
        // Keep HTTP cache warm-ish as well; response is user-invariant but the route is authed.
        headers: { "Cache-Control": CACHE_CONTROL_PRIVATE_WARM_CHART },
      },
    );
  } catch (e) {
    if (e instanceof AuthRequiredError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const message = e instanceof Error ? e.message : "Server error";
    console.error("[portfolio header-meta]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

