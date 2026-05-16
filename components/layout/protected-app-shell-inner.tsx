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
  SidebarLayoutProvider,
  useSidebarLayout,
} from "@/components/layout/sidebar-layout-context";
import { Topbar } from "@/components/layout/topbar";

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

  return (
    <div
      suppressHydrationWarning
      className="mobile-document-scroll-shell relative flex min-h-[var(--app-vh)] w-full flex-1 flex-col bg-white max-md:overflow-visible md:block md:h-dvh md:max-h-dvh md:flex-none md:overflow-hidden md:bg-[var(--background)]"
      style={{ ["--shell-left" as string]: leftOffset } as CSSProperties}
    >
      <Suspense fallback={null}>
        <NavigationTopLoader />
      </Suspense>
      <div
        className="fixed inset-y-0 left-0 z-20 hidden p-1 transition-[width] duration-200 ease-out md:block md:top-1 md:bottom-1 md:p-0 md:px-1 md:py-0"
        style={{ width: leftOffset }}
      >
        <Sidebar />
      </div>
      <div
        suppressHydrationWarning
        className="z-30 min-w-0 shrink-0 bg-white max-md:relative max-md:w-full max-md:shadow-none md:fixed md:right-1 md:top-1 md:rounded-[4px] md:bg-white md:py-1 md:shadow-[0_1px_0_0_rgba(0,0,0,0.03)] md:transition-[left] md:duration-200 md:ease-out left-1 max-md:left-0 md:left-[length:var(--shell-left)]"
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
        className="relative z-0 min-w-0 w-full flex-1 bg-white max-md:overflow-visible max-md:pb-[var(--mobile-bottom-nav-main-clearance)] md:fixed md:right-1 md:bottom-1 md:left-[length:var(--shell-left)] md:top-[74px] md:z-0 md:overflow-y-auto md:overscroll-y-contain md:rounded-[4px] md:transition-[left] md:duration-200 md:ease-out"
      >
        {children}
      </main>
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
}: {
  children: ReactNode;
  userId: string;
  userInitials: string;
  avatarUrl: string | null;
  userDisplayName: string;
  /** Days remaining in the platform free trial; shown in the top bar until the user subscribes. */
  platformTrialDaysLeft?: number | null;
}) {
  return (
    <SidebarLayoutProvider>
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
