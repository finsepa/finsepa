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
      suppressHydrationWarning
      className="mobile-document-scroll-shell relative flex min-h-[var(--app-vh)] w-full flex-1 flex-col bg-white max-md:overflow-visible md:block md:h-dvh md:max-h-dvh md:flex-none md:overflow-hidden md:bg-[var(--background)]"
    >
      <Suspense fallback={null}>
        <NavigationTopLoader />
      </Suspense>
      <div
        suppressHydrationWarning
        className={cn(
          "fixed inset-y-0 left-0 z-20 hidden p-1 md:block md:top-[var(--shell-chrome-inset)] md:bottom-[var(--shell-chrome-inset)] md:p-0 md:px-1 md:py-0",
          SIDEBAR_WIDTH_MOTION_CLASS,
        )}
        style={{ width: leftOffset }}
      >
        <Sidebar />
      </div>

      {/*
       * Desktop: one inset column (4px top/right/bottom, 4px gap) so topbar + main share width.
       * Mobile: stacked column with document scroll (unchanged).
       */}
      <div
        suppressHydrationWarning
        className={cn(
          "flex min-h-0 min-w-0 flex-1 flex-col max-md:min-h-[var(--app-vh)] md:fixed md:top-[var(--shell-chrome-inset)] md:right-[var(--shell-chrome-inset)] md:bottom-[var(--shell-chrome-inset)] md:left-[length:var(--shell-left)] md:z-0 md:gap-[var(--shell-chrome-gap)] md:overflow-hidden",
          SIDEBAR_WIDTH_MOTION_CLASS,
        )}
        style={chromeColumnStyle}
      >
        <div
          suppressHydrationWarning
          className={cn(
            "z-30 min-w-0 w-full max-w-full shrink-0 bg-white max-md:relative max-md:shadow-none md:rounded-[4px] md:bg-white md:shadow-[0_1px_0_0_rgba(0,0,0,0.03)]",
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
        <main
          ref={mainRef}
          suppressHydrationWarning
          className="relative z-0 min-h-0 min-w-0 w-full max-w-full flex-1 bg-white max-md:overflow-visible max-md:pb-[var(--mobile-bottom-nav-main-clearance)] md:overflow-x-hidden md:overflow-y-auto md:overscroll-y-contain md:rounded-[4px]"
        >
          {children}
        </main>
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
}) {
  return (
    <SidebarLayoutProvider initialCollapsed={initialSidebarCollapsed}>
      <ProtectedAppChrome
        userId={userId}
        userInitials={userInitials}
        avatarUrl={avatarUrl}
        userDisplayName={userDisplayName}
        platformTrialDaysLeft={platformTrialDaysLeft ?? null}
      >
        {children}
      </ProtectedAppChrome>
    </SidebarLayoutProvider>
  );
}
