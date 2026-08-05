import { NextResponse } from "next/server";

import {
  EMPTY_FREE_PLAN_SELECTION,
  loadFreePlanSelection,
  patchFreePlanSelection,
  freeActiveManualPortfolioExists,
} from "@/lib/account/free-plan-selection";
import { getSubscriptionGateContext } from "@/lib/account/subscription-gate";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** GET free-plan selection + plan entitlements (for client Free limits UI). */
export async function GET() {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [gate, selection] = await Promise.all([
    getSubscriptionGateContext(supabase, user.id),
    loadFreePlanSelection(supabase, user.id),
  ]);

  return NextResponse.json({
    tier: gate.tier,
    isPro: gate.isPro,
    isTrial: gate.isTrial,
    isFree: gate.isFree,
    topbarTrialDaysLeft: gate.topbarTrialDaysLeft,
    entitlements: {
      maxRealPortfolios: gate.maxRealPortfolios,
      maxWatchlists: gate.maxWatchlists,
      canUseAgent: gate.canUseAgent,
      canPublishPublicPortfolio: gate.canPublishPublicPortfolio,
      canCreateCombinedPortfolio: gate.canCreateCombinedPortfolio,
      canCreatePortfolio: gate.canCreatePortfolio,
      canCreateWatchlist: gate.canCreateWatchlist,
      canConnectBrokerage: gate.canConnectBrokerage,
      canUseActivityAlerts: gate.canUseActivityAlerts,
    },
    selection: selection ?? EMPTY_FREE_PLAN_SELECTION,
  });
}

type PatchBody = {
  freeActivePortfolioId?: string | null;
  freeActiveWatchlistId?: string | null;
  lockPortfolioSelection?: boolean;
  lockWatchlistSelection?: boolean;
  ackLimits?: boolean;
  /** Free recovery: clear lock when free_active portfolio was deleted. */
  clearStaleFreePortfolioSelection?: boolean;
};

/** POST free-plan selection (pick / ack). Cannot re-pick once locked while still Free. */
export async function POST(request: Request) {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const gate = await getSubscriptionGateContext(supabase, user.id);
  let body: PatchBody;
  try {
    body = (await request.json()) as PatchBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const existing = await loadFreePlanSelection(supabase, user.id);
  const patch: Parameters<typeof patchFreePlanSelection>[2] = {};

  if (body.ackLimits === true) {
    patch.free_plan_limits_acked_at = new Date().toISOString();
  }

  if (gate.isPro || gate.isTrial) {
    // Pro/trial may clear locks after upgrade / during trial.
    if (body.freeActivePortfolioId !== undefined) {
      patch.free_active_portfolio_id = body.freeActivePortfolioId;
      if (body.lockPortfolioSelection === true) patch.free_portfolio_selection_locked = true;
    }
    if (body.freeActiveWatchlistId !== undefined) {
      patch.free_active_watchlist_id = body.freeActiveWatchlistId;
      if (body.lockWatchlistSelection === true) patch.free_watchlist_selection_locked = true;
    }
    if (body.lockPortfolioSelection === false) patch.free_portfolio_selection_locked = false;
    if (body.lockWatchlistSelection === false) patch.free_watchlist_selection_locked = false;
  } else {
    // Free: lock once chosen — no switching, unless the locked active was deleted.
    if (
      body.freeActivePortfolioId !== undefined &&
      typeof body.freeActivePortfolioId === "string" &&
      body.freeActivePortfolioId.trim()
    ) {
      if (existing.free_portfolio_selection_locked && existing.free_active_portfolio_id) {
        const stillExists = await freeActiveManualPortfolioExists(
          user.id,
          existing.free_active_portfolio_id,
        );
        if (stillExists) {
          return NextResponse.json(
            {
              error: "Free portfolio already selected. Upgrade to Pro to access all portfolios.",
              code: "FREE_PORTFOLIO_LOCKED",
            },
            { status: 403 },
          );
        }
      }
      patch.free_active_portfolio_id = body.freeActivePortfolioId.trim();
      patch.free_portfolio_selection_locked = true;
    }

    if (body.clearStaleFreePortfolioSelection === true) {
      if (existing.free_portfolio_selection_locked && existing.free_active_portfolio_id) {
        const stillExists = await freeActiveManualPortfolioExists(
          user.id,
          existing.free_active_portfolio_id,
        );
        if (!stillExists) {
          patch.free_active_portfolio_id = null;
          patch.free_portfolio_selection_locked = false;
        }
      }
    }

    if (
      body.freeActiveWatchlistId !== undefined &&
      typeof body.freeActiveWatchlistId === "string" &&
      body.freeActiveWatchlistId.trim()
    ) {
      if (existing.free_watchlist_selection_locked && existing.free_active_watchlist_id) {
        return NextResponse.json(
          {
            error: "Free watchlist already selected. Upgrade to Pro to access all watchlists.",
            code: "FREE_WATCHLIST_LOCKED",
          },
          { status: 403 },
        );
      }
      patch.free_active_watchlist_id = body.freeActiveWatchlistId.trim();
      patch.free_watchlist_selection_locked = true;
    }
  }

  const result = await patchFreePlanSelection(supabase, user.id, patch);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  const selection = await loadFreePlanSelection(supabase, user.id);
  return NextResponse.json({ ok: true, selection });
}
