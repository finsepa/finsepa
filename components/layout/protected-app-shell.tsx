import { Suspense, type ReactNode } from "react";
import type { User } from "@supabase/supabase-js";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { getSubscriptionGateContext } from "@/lib/account/subscription-gate";
import { PATH_ACTIVATE_SUBSCRIPTION, PATH_LOGIN } from "@/lib/auth/routes";
import { scheduleWelcomeTrialStartEmailFromHeaders } from "@/lib/auth/welcome-trial-start-on-login";
import { avatarUrlFromUser, displayNameFromUser, initialsFromUser } from "@/lib/auth/user-display";
import { ProtectedAppShellInner } from "@/components/layout/protected-app-shell-inner";
import { OnboardingAuthBootstrap } from "@/components/onboarding/onboarding-auth-bootstrap";
import { ScreenerOnboardingHost } from "@/components/onboarding/screener-onboarding-host";
import { PortfolioWorkspaceProvider } from "@/components/portfolio/portfolio-workspace-provider";
import { WatchlistProvider } from "@/lib/watchlist/use-watchlist-client";
import { userNeedsOnboarding } from "@/lib/auth/onboarding";
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

const getSubscriptionGateContextCached = cache(getSubscriptionGateContext);

export async function ProtectedAppShell({ children }: { children: ReactNode }) {
  let user: User | null = null;
  let supabase: Awaited<ReturnType<typeof getSupabaseServerClient>> | null = null;
  try {
    const [client, cookieStore, requestHeaders] = await Promise.all([
      getSupabaseServerClient(),
      cookies(),
      headers(),
    ]);
    supabase = client;
    const {
      data: { user: u },
    } = await supabase.auth.getUser();
    user = u;

    if (user) {
      scheduleWelcomeTrialStartEmailFromHeaders(user, requestHeaders);
    }

    if (!user || !supabase) {
      redirect(PATH_LOGIN);
    }

    const gate = await getSubscriptionGateContextCached(supabase, user.id);
    if (gate.needsPaywall) {
      redirect(PATH_ACTIVATE_SUBSCRIPTION);
    }

    const userInitials = initialsFromUser(user);
    const avatarUrl = avatarUrlFromUser(user);
    const userDisplayName = displayNameFromUser(user) ?? user.email?.split("@")[0] ?? "Member";
    const listingOwnerDisplayName = userDisplayName;
    const serverShouldShowOnboarding = userNeedsOnboarding(user);

    const initialSidebarCollapsed = readSidebarCollapsedPreference(
      cookieStore.get(SIDEBAR_COLLAPSED_PREFERENCE_KEY)?.value,
    );
    const initialWatchlistRailCollapsed = readWatchlistRailCollapsedPreference(
      cookieStore.get(WATCHLIST_RAIL_COLLAPSED_PREFERENCE_KEY)?.value,
    );

    /* Sidebar width: 240px expanded / 72px collapsed (see sidebar-layout-context). */
    return (
      <PortfolioWorkspaceProvider
        userId={user.id}
        listingOwnerDisplayName={listingOwnerDisplayName}
        listingOwnerAvatarUrl={avatarUrl}
      >
        <WatchlistProvider>
          <ProtectedAppShellInner
          userId={user.id}
          userInitials={userInitials}
          avatarUrl={avatarUrl}
          userDisplayName={userDisplayName}
          platformTrialDaysLeft={gate.topbarTrialDaysLeft}
          initialSidebarCollapsed={initialSidebarCollapsed}
          initialWatchlistRailCollapsed={initialWatchlistRailCollapsed}
        >
          <OnboardingAuthBootstrap />
          <Suspense fallback={null}>
            <ScreenerOnboardingHost userId={user.id} serverShouldShow={serverShouldShowOnboarding} />
          </Suspense>
          {children}
        </ProtectedAppShellInner>
        </WatchlistProvider>
      </PortfolioWorkspaceProvider>
    );
  } catch {
    redirect(PATH_LOGIN);
  }
}
