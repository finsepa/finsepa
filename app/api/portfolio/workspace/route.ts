import { NextResponse } from "next/server";

import { requireAuthUser, AuthRequiredError } from "@/lib/watchlist/api-auth";
import {
  type PersistedPortfolioState,
  parsePersistedPortfolioUnknown,
} from "@/lib/portfolio/portfolio-storage";
import { getSupabaseServerClient } from "@/lib/supabase/server";

function summarizeState(s: PersistedPortfolioState): { portfolioCount: number; holdingCount: number; txCount: number } {
  let holdingCount = 0;
  let txCount = 0;
  for (const p of s.portfolios) {
    holdingCount += s.holdingsByPortfolioId[p.id]?.length ?? 0;
    txCount += s.transactionsByPortfolioId[p.id]?.length ?? 0;
  }
  return { portfolioCount: s.portfolios.length, holdingCount, txCount };
}

export async function GET() {
  try {
    const supabase = await getSupabaseServerClient();
    const user = await requireAuthUser(supabase);

    const { data, error } = await supabase
      .from("portfolio_workspace")
      .select("state,updated_at")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) {
      console.error("[portfolio/workspace GET]", error.message);
      return NextResponse.json({ state: null, updatedAt: null, warning: "db_unavailable" as const });
    }

    if (!data?.state) {
      return NextResponse.json({ state: null, updatedAt: null });
    }

    const state = parsePersistedPortfolioUnknown(data.state);
    if (!state) {
      return NextResponse.json({ state: null, updatedAt: null, warning: "invalid_state" as const });
    }

    return NextResponse.json({
      state,
      updatedAt: typeof data.updated_at === "string" ? data.updated_at : null,
      summary: summarizeState(state),
    });
  } catch (e) {
    if (e instanceof AuthRequiredError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const message = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const supabase = await getSupabaseServerClient();
    const user = await requireAuthUser(supabase);

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }

    const rawState =
      body && typeof body === "object" && body !== null && "state" in body
        ? (body as { state: unknown }).state
        : body;

    const state = parsePersistedPortfolioUnknown(rawState);
    if (!state) {
      return NextResponse.json({ error: "Invalid portfolio state payload." }, { status: 400 });
    }

    const now = new Date().toISOString();
    const { error } = await supabase.from("portfolio_workspace").upsert(
      {
        user_id: user.id,
        state,
        updated_at: now,
      },
      { onConflict: "user_id" },
    );

    if (error) {
      console.error("[portfolio/workspace PUT]", error.message);
      return NextResponse.json({ ok: false, warning: "db_unavailable" as const }, { status: 200 });
    }

    return NextResponse.json({ ok: true, updatedAt: now, summary: summarizeState(state) });
  } catch (e) {
    if (e instanceof AuthRequiredError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const message = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
