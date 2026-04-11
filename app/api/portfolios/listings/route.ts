import type { User } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

import { avatarUrlFromUser, displayNameFromUser } from "@/lib/auth/user-display";
import { requireAuthUser, AuthRequiredError } from "@/lib/watchlist/api-auth";
import { getSupabaseServerClient } from "@/lib/supabase/server";

const NUMERIC_METRIC_KEYS = [
  "valueUsd",
  "totalProfitUsd",
  "totalProfitPct",
  "spyReturnPct",
  "dividendsYieldPct",
  "holdingCount",
  "returnsAthPct",
] as const;

/** Persists allowed keys only for `metrics` jsonb (numbers + owner + top symbols). */
function sanitizeMetrics(input: unknown): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (!input || typeof input !== "object") return out;
  const o = input as Record<string, unknown>;
  for (const k of NUMERIC_METRIC_KEYS) {
    const v = o[k];
    if (typeof v === "number" && Number.isFinite(v)) out[k] = v;
  }

  const rawSyms = o.topSymbols;
  if (Array.isArray(rawSyms)) {
    const top = rawSyms
      .filter((x): x is string => typeof x === "string")
      .map((s) => s.trim().toUpperCase().slice(0, 24))
      .filter(Boolean)
      .slice(0, 5);
    if (top.length) out.topSymbols = top;
  }

  return out;
}

/** Owner identity always comes from the session user (not the client payload). */
function ownerFieldsForListingMetrics(user: User): { ownerDisplayName: string; ownerAvatarUrl?: string } {
  const ownerDisplayName =
    displayNameFromUser(user) ?? user.email?.split("@")[0]?.trim() ?? "Member";
  const url = avatarUrlFromUser(user);
  const ownerAvatarUrl =
    url && /^https?:\/\//i.test(url) && url.length <= 2000 ? url : undefined;
  return ownerAvatarUrl ? { ownerDisplayName, ownerAvatarUrl } : { ownerDisplayName };
}

/** Community directory: all published snapshots (authenticated users). */
export async function GET() {
  try {
    const supabase = await getSupabaseServerClient();
    await requireAuthUser(supabase);

    const { data, error } = await supabase
      .from("public_portfolio_listings")
      .select("id, display_name, metrics, updated_at")
      .order("updated_at", { ascending: false });

    if (error) {
      console.error("[portfolios/listings GET]", error.message);
      return NextResponse.json({ listings: [] as const, warning: "db_unavailable" as const });
    }

    const listings = (data ?? []).map((row) => ({
      id: row.id as string,
      name: row.display_name as string,
      metrics: (row.metrics ?? {}) as Record<string, unknown>,
      updatedAt: typeof row.updated_at === "string" ? row.updated_at : null,
    }));

    return NextResponse.json({ listings });
  } catch (e) {
    if (e instanceof AuthRequiredError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const message = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

type PutBody = {
  portfolioId?: unknown;
  publish?: unknown;
  displayName?: unknown;
  metrics?: unknown;
};

/** Publish or unpublish the current user's portfolio snapshot. */
export async function PUT(request: Request) {
  try {
    const supabase = await getSupabaseServerClient();
    const user = await requireAuthUser(supabase);

    let body: PutBody;
    try {
      body = (await request.json()) as PutBody;
    } catch {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }

    const portfolioId = typeof body.portfolioId === "string" ? body.portfolioId.trim() : "";
    if (!portfolioId) {
      return NextResponse.json({ error: "portfolioId is required." }, { status: 400 });
    }

    const publish = body.publish === true;

    if (!publish) {
      const { error } = await supabase
        .from("public_portfolio_listings")
        .delete()
        .eq("user_id", user.id)
        .eq("portfolio_id", portfolioId);

      if (error) {
        console.error("[portfolios/listings PUT delete]", error.message);
        return NextResponse.json({ ok: false, warning: "db_unavailable" as const });
      }
      return NextResponse.json({ ok: true });
    }

    const displayName = typeof body.displayName === "string" ? body.displayName.trim() : "";
    if (!displayName) {
      return NextResponse.json({ error: "displayName is required when publish is true." }, { status: 400 });
    }

    const metrics = {
      ...sanitizeMetrics(body.metrics),
      ...ownerFieldsForListingMetrics(user),
    };
    const now = new Date().toISOString();

    const { error } = await supabase.from("public_portfolio_listings").upsert(
      {
        user_id: user.id,
        portfolio_id: portfolioId,
        display_name: displayName,
        metrics,
        updated_at: now,
      },
      { onConflict: "user_id,portfolio_id" },
    );

    if (error) {
      console.error("[portfolios/listings PUT upsert]", error.message);
      return NextResponse.json({ ok: false, warning: "db_unavailable" as const });
    }

    return NextResponse.json({ ok: true, updatedAt: now });
  } catch (e) {
    if (e instanceof AuthRequiredError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const message = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
