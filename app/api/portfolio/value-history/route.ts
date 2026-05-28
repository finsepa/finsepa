import { NextResponse } from "next/server";

import { unstable_cache } from "next/cache";

import { CACHE_CONTROL_PRIVATE_WARM } from "@/lib/data/cache-policy";
import { requireAuthUser, AuthRequiredError } from "@/lib/watchlist/api-auth";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import {
  computePortfolioValueHistory,
  parsePortfolioValueHistoryBody,
} from "@/lib/portfolio/portfolio-value-history.server";

function txFingerprint(transactions: { id: string; date: string; kind: string; operation?: string; symbol?: string; shares?: number; price?: number; fee?: number }[]): string {
  const parts = transactions.map((t) => `${t.id}|${t.date}|${t.kind}|${t.operation ?? ""}|${t.symbol ?? ""}|${t.shares ?? ""}|${t.price ?? ""}|${t.fee ?? ""}`);
  parts.sort();
  return parts.join(";");
}

export async function POST(request: Request) {
  try {
    const supabase = await getSupabaseServerClient();
    const user = await requireAuthUser(supabase);

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const parsed = parsePortfolioValueHistoryBody(body);
    if (!parsed) {
      return NextResponse.json({ error: "Invalid body" }, { status: 400 });
    }

    const fp = txFingerprint(parsed.transactions);
    const getCached = unstable_cache(
      async (userId: string, range: string, txFp: string) => {
        // parsed.transactions can be large; fingerprint is used only for the cache key.
        // We still compute from the raw transactions payload.
        void txFp;
        return computePortfolioValueHistory(parsed.range, parsed.transactions);
      },
      ["portfolio-value-history-v1"],
      { revalidate: 300 },
    );
    const points = await getCached(user.id, parsed.range, fp);

    return NextResponse.json(
      { points },
      {
        headers: {
          "Cache-Control": CACHE_CONTROL_PRIVATE_WARM,
        },
      },
    );
  } catch (e) {
    if (e instanceof AuthRequiredError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const message = e instanceof Error ? e.message : "Server error";
    console.error("[portfolio value-history]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
