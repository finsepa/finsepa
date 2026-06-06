"use client";

import type { CSSProperties, ReactNode } from "react";
import { Suspense, useRef } from "react";

import { MainScrollToTop } from "@/components/layout/main-scroll-to-top";
import { MobileBottomNav } from "@/components/layout/mobile-bottom-nav";
import { NavigationTopLoader } from "@/components/layout/navigation-top-loader";
import { Sidebar } from "@/components/layout/sidebar";
import {
  SIDEBAR_OUTER_COLLAPSED_PX,
  SIDEBAR_OUTER_EXPANDED_PX,
  SIDEBAR_WIDTH_MOTION_CLASS,
  SidebarLayoutProvider,
  useSidebarLayout,
} from "@/components/layout/sidebar-layout-context";
import { Topbar } from "@/components/layout/topbar";
import { WatchlistRail } from "@/components/layout/watchlist-rail";
import { WatchlistRailLayoutProvider } from "@/components/layout/watchlist-rail-layout-context";
import { dropdownMenuFloatingScrollClassName } from "@/components/design-system/dropdown-menu-styles";
import { cn } from "@/lib/utils";

function ProtectedAppChrome({
  children,
  userId,
  userInitials,
  avatarUrl,
  userDisplayName,
  platformTrialDaysLeft,
}: {
  children: ReactNode;
  userId: string;
  userInitials: string;
  avatarUrl: string | null;
  userDisplayName: string;
  platformTrialDaysLeft: number | null;
}) {
  const { collapsed } = useSidebarLayout();
  const outerPx = collapsed ? SIDEBAR_OUTER_COLLAPSED_PX : SIDEBAR_OUTER_EXPANDED_PX;
  const leftOffset = `${outerPx}px`;

  const mainRef = useRef<HTMLElement>(null);

  const chromeColumnStyle = {
    ["--shell-left" as string]: leftOffset,
  } as CSSProperties;

  return (
    <div
      id="app-shell-root"
      suppressHydrationWarning
      className="mobile-document-scroll-shell relative flex min-h-[var(--app-vh)] w-full flex-1 flex-col bg-white max-md:overflow-visible md:block md:h-dvh md:max-h-dvh md:flex-none md:overflow-hidden md:bg-[#F4F4F5]"
    >
      <Suspense fallback={null}>
        <NavigationTopLoader />
      </Suspense>
      <div
        suppressHydrationWarning
        className={cn(
          "fixed inset-y-0 left-0 z-20 hidden p-1 md:block md:border-r md:border-[#E4E4E7] md:p-0",
          SIDEBAR_WIDTH_MOTION_CLASS,
        )}
        style={{ width: leftOffset }}
      >
        <Sidebar />
      </div>

      {/*
       * Desktop: one card (topbar + main + watchlist) with outer padding top/right/bottom.
       * Mobile: stacked column with document scroll (unchanged).
       */}
      <div
        suppressHydrationWarning
        className={cn(
          "flex min-h-0 min-w-0 flex-1 flex-col max-md:min-h-[var(--app-vh)] md:fixed md:inset-y-0 md:right-0 md:left-[length:var(--shell-left)] md:z-0 md:overflow-hidden md:bg-[#F4F4F5] md:pt-[var(--shell-desktop-padding-top)] md:pr-[var(--shell-desktop-padding-right)] md:pb-[var(--shell-desktop-padding-bottom)]",
          SIDEBAR_WIDTH_MOTION_CLASS,
        )}
        style={chromeColumnStyle}
      >
        <div
          suppressHydrationWarning
          className={cn(
            "shell-desktop-panel flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden max-md:min-h-[var(--app-vh)] max-md:rounded-none max-md:border-0 max-md:bg-transparent max-md:shadow-none",
            SIDEBAR_WIDTH_MOTION_CLASS,
          )}
        >
          <div
            suppressHydrationWarning
            className={cn(
              "z-30 min-w-0 w-full max-w-full shrink-0 bg-white max-md:relative max-md:shadow-none md:border-b md:border-[#E4E4E7] md:bg-white",
              SIDEBAR_WIDTH_MOTION_CLASS,
            )}
          >
            <Topbar
              userId={userId}
              userInitials={userInitials}
              avatarUrl={avatarUrl}
              userDisplayName={userDisplayName}
              platformTrialDaysLeft={platformTrialDaysLeft}
            />
          </div>
          <div
            suppressHydrationWarning
            className="flex min-h-0 min-w-0 flex-1 max-md:flex-col"
          >
            <main
              ref={mainRef}
              suppressHydrationWarning
              className={cn(
                "relative z-0 min-h-0 min-w-0 w-full max-w-full flex-1 bg-white max-md:overflow-visible max-md:pb-[var(--mobile-bottom-nav-main-clearance)] md:overflow-x-hidden md:overflow-y-auto md:overscroll-y-contain",
                dropdownMenuFloatingScrollClassName,
              )}
            >
              {children}
            </main>
            <WatchlistRail />
          </div>
        </div>
      </div>

      <MainScrollToTop scrollRootRef={mainRef} />
      <MobileBottomNav />
    </div>
  );
}

export function ProtectedAppShellInner({
  children,
  userId,
  userInitials,
  avatarUrl,
  userDisplayName,
  platformTrialDaysLeft = null,
  initialSidebarCollapsed = false,
  initialWatchlistRailCollapsed = true,
}: {
  children: ReactNode;
  userId: string;
  userInitials: string;
  avatarUrl: string | null;
  userDisplayName: string;
  /** Days remaining in the platform free trial; shown in the top bar until the user subscribes. */
  platformTrialDaysLeft?: number | null;
  /** Server-read cookie so sidebar width matches on SSR and hydration. */
  initialSidebarCollapsed?: boolean;
  /** Server-read cookie for desktop watchlist rail (collapsed = star strip only). */
  initialWatchlistRailCollapsed?: boolean;
}) {
  return (
    <SidebarLayoutProvider initialCollapsed={initialSidebarCollapsed}>
      <WatchlistRailLayoutProvider initialCollapsed={initialWatchlistRailCollapsed}>
        <ProtectedAppChrome
          userId={userId}
          userInitials={userInitials}
          avatarUrl={avatarUrl}
          userDisplayName={userDisplayName}
          platformTrialDaysLeft={platformTrialDaysLeft ?? null}
        >
          {children}
        </ProtectedAppChrome>
      </WatchlistRailLayoutProvider>
    </SidebarLayoutProvider>
  );
}
