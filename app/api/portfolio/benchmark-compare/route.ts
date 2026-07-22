import { NextResponse } from "next/server";

import { BENCHMARK_DEFAULT_TICKER } from "@/lib/portfolio/benchmark/benchmark-engine";
import { computeInceptionBenchmarkCompare } from "@/lib/portfolio/benchmark/benchmark-compare.server";
import { parseBodyTransactions } from "@/lib/portfolio/portfolio-value-history.server";
import { requireAuthUser, AuthRequiredError } from "@/lib/watchlist/api-auth";
import { getSupabaseServerClient } from "@/lib/supabase/server";

const MAX_TX = 4000;

/**
 * Contribution-model benchmark compare (Modified Dietz vs Modified Dietz).
 * Body: { transactions, benchmark?: "SPY" }
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

    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid body" }, { status: 400 });
    }
    const o = body as Record<string, unknown>;
    const rawTx = o.transactions;
    if (!Array.isArray(rawTx) || rawTx.length > MAX_TX) {
      return NextResponse.json({ error: "Invalid transactions" }, { status: 400 });
    }
    const transactions = parseBodyTransactions(rawTx);
    if (transactions == null) {
      return NextResponse.json({ error: "Invalid transactions" }, { status: 400 });
    }

    const b = o.benchmark;
    const benchmark =
      typeof b === "string" && b.trim() ? b.trim().toUpperCase() : BENCHMARK_DEFAULT_TICKER;

    const compare = await computeInceptionBenchmarkCompare(transactions, benchmark);
    if (!compare) {
      return NextResponse.json({
        portfolioPct: null,
        benchmarkPct: null,
        aheadPct: null,
        benchmark,
      });
    }

    return NextResponse.json(
      {
        portfolioPct: compare.portfolioPct,
        benchmarkPct: compare.benchmarkPct,
        aheadPct: compare.aheadPct,
        benchmark,
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (e) {
    if (e instanceof AuthRequiredError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const message = e instanceof Error ? e.message : "Server error";
    console.error("[portfolio benchmark-compare]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
