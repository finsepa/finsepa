"use client";

import type { ReactNode } from "react";
import { Suspense } from "react";

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
  userInitials,
  avatarUrl,
  userDisplayName,
}: {
  children: ReactNode;
  userInitials: string;
  avatarUrl: string | null;
  userDisplayName: string;
}) {
  const { collapsed } = useSidebarLayout();
  const outerPx = collapsed ? SIDEBAR_OUTER_COLLAPSED_PX : SIDEBAR_OUTER_EXPANDED_PX;
  const leftOffset = `${outerPx}px`;

  return (
    <div className="relative h-dvh max-h-dvh w-full overflow-hidden bg-[rgba(228,228,231,1)]">
      <Suspense fallback={null}>
        <NavigationTopLoader />
      </Suspense>
      <div
        className="fixed inset-y-0 left-0 z-20 p-1 transition-[width] duration-200 ease-out"
        style={{ width: leftOffset }}
      >
        <Sidebar />
      </div>
      <div
        className="fixed right-1 top-1 z-30 rounded-[4px] bg-white py-1 shadow-[0_1px_0_0_rgba(0,0,0,0.03)] transition-[left] duration-200 ease-out"
        style={{ left: leftOffset }}
      >
        <Topbar userInitials={userInitials} avatarUrl={avatarUrl} userDisplayName={userDisplayName} />
      </div>
      <main
        className="fixed bottom-1 right-1 top-[76px] z-0 overflow-y-auto rounded-[4px] bg-white transition-[left] duration-200 ease-out"
        style={{ left: leftOffset }}
      >
        {children}
      </main>
    </div>
  );
}

export function ProtectedAppShellInner({
  children,
  userInitials,
  avatarUrl,
  userDisplayName,
}: {
  children: ReactNode;
  userInitials: string;
  avatarUrl: string | null;
  userDisplayName: string;
}) {
  return (
    <SidebarLayoutProvider>
      <ProtectedAppChrome
        userInitials={userInitials}
        avatarUrl={avatarUrl}
        userDisplayName={userDisplayName}
      >
        {children}
      </ProtectedAppChrome>
    </SidebarLayoutProvider>
  );
}
