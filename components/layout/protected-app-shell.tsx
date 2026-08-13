import type { ReactNode } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { subscriptionGateFromBillingRow } from "@/lib/account/resolve-plan-tier";
import { getSubscriptionGateContext } from "@/lib/account/subscription-gate";
import { PATH_LOGIN } from "@/lib/auth/routes";
import { scheduleWelcomeTrialStartEmailFromHeaders } from "@/lib/auth/welcome-trial-start-on-login";
import { avatarUrlFromUser, displayNameFromUser, initialsFromUser } from "@/lib/auth/user-display";
import { FreePlanLimitsIntroModal } from "@/components/account/free-plan-modals";
import { PlanAccessProvider } from "@/components/account/plan-access-provider";
import { ProtectedAppShellInner } from "@/components/layout/protected-app-shell-inner";
import { AuthSessionUrlBootstrap } from "@/components/onboarding/onboarding-auth-bootstrap";
import { PortfolioWorkspaceProvider } from "@/components/portfolio/portfolio-workspace-provider";
import { SuperinvestorFollowProvider } from "@/components/superinvestors/superinvestor-follow-provider";
import { WatchlistProvider } from "@/lib/watchlist/use-watchlist-client";
import { userFromJwtClaims } from "@/lib/auth/user-from-claims";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import {
  readSidebarCollapsedPreference,
  SIDEBAR_COLLAPSED_PREFERENCE_KEY,
} from "@/lib/layout/sidebar-collapsed-preference";
import {
  readWatchlistRailCollapsedPreference,
  WATCHLIST_RAIL_COLLAPSED_PREFERENCE_KEY,
} from "@/lib/layout/watchlist-rail-collapsed-preference";

/** Re-read sidebar/watchlist cookies on each navigation (separate route-group layouts). */
export const dynamic = "force-dynamic";

/** Billing SELECT must not freeze screener/shell first paint on a cold pooler. */
const SUBSCRIPTION_GATE_BUDGET_MS = 3_000;

const getSubscriptionGateContextCached = cache(getSubscriptionGateContext);

export async function ProtectedAppShell({
  children,
  mobileTopbarVariant,
}: {
  children: ReactNode;
  /** Stock asset pages include section tabs in the fixed mobile top bar. */
  mobileTopbarVariant?: "stock";
}) {
  const [supabase, cookieStore, requestHeaders] = await Promise.all([
    getSupabaseServerClient(),
    cookies(),
    headers(),
  ]);

  let user: Awaited<ReturnType<typeof supabase.auth.getUser>>["data"]["user"] = null;
  try {
    const { data: claimsData } = await supabase.auth.getClaims();
    user = userFromJwtClaims(claimsData?.claims ?? null);
    // Best-effort enrich for avatar / display fields — do not block the shell on Auth latency.
    if (user) {
      try {
        const enriched = await Promise.race([
          supabase.auth.getUser(),
          new Promise<null>((resolve) => {
            setTimeout(() => resolve(null), 1_500);
          }),
        ]);
        if (enriched && enriched.data.user) user = enriched.data.user;
      } catch {
        /* keep claims-based user during Auth latency / outage */
      }
    }
  } catch {
    // Claims read threw — still try a short getUser before bouncing to login.
    try {
      const {
        data: { user: networkUser },
      } = await Promise.race([
        supabase.auth.getUser(),
        new Promise<{ data: { user: null } }>((resolve) => {
          setTimeout(() => resolve({ data: { user: null } }), 1_500);
        }),
      ]);
      user = networkUser;
    } catch {
      /* fall through */
    }
  }

  if (!user) {
    redirect(PATH_LOGIN);
  }

  scheduleWelcomeTrialStartEmailFromHeaders(user, requestHeaders);

  let gate = subscriptionGateFromBillingRow(null);
  try {
    const resolved = await Promise.race([
      getSubscriptionGateContextCached(supabase, user.id),
      new Promise<null>((resolve) => {
        setTimeout(() => resolve(null), SUBSCRIPTION_GATE_BUDGET_MS);
      }),
    ]);
    if (resolved) gate = resolved;
  } catch {
    /* keep Free fallback — PlanAccessProvider can refresh client-side */
  }

  const userInitials = initialsFromUser(user);
  const avatarUrl = avatarUrlFromUser(user);
  const userDisplayName = displayNameFromUser(user) ?? user.email?.split("@")[0] ?? "Member";
  const listingOwnerDisplayName = userDisplayName;

  const initialSidebarCollapsed = readSidebarCollapsedPreference(
    cookieStore.get(SIDEBAR_COLLAPSED_PREFERENCE_KEY)?.value,
  );
  const initialWatchlistRailCollapsed = readWatchlistRailCollapsedPreference(
    cookieStore.get(WATCHLIST_RAIL_COLLAPSED_PREFERENCE_KEY)?.value,
  );

  /* Sidebar width: 240px expanded / 72px collapsed (see sidebar-layout-context). */
  return (
    <PlanAccessProvider initial={gate}>
    <PortfolioWorkspaceProvider
      userId={user.id}
      listingOwnerDisplayName={listingOwnerDisplayName}
      listingOwnerAvatarUrl={avatarUrl}
    >
      <WatchlistProvider>
        <SuperinvestorFollowProvider>
        <ProtectedAppShellInner
          userId={user.id}
          userInitials={userInitials}
          avatarUrl={avatarUrl}
          userDisplayName={userDisplayName}
          platformTrialDaysLeft={gate.topbarTrialDaysLeft}
          isPro={gate.isPro}
          initialSidebarCollapsed={initialSidebarCollapsed}
          initialWatchlistRailCollapsed={initialWatchlistRailCollapsed}
          mobileTopbarVariant={mobileTopbarVariant}
        >
          <AuthSessionUrlBootstrap />
          <FreePlanLimitsIntroModal />
          {children}
        </ProtectedAppShellInner>
        </SuperinvestorFollowProvider>
      </WatchlistProvider>
    </PortfolioWorkspaceProvider>
    </PlanAccessProvider>
  );
}
