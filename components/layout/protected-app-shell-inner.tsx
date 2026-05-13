"use client";

import type { CSSProperties, ReactNode } from "react";
import { Suspense, useCallback, useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

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
import { MOBILE_SHELL_TOPBAR_PUSH_PX } from "@/lib/layout/main-shell-scroll-threshold";

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
  const topbarWrapRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const scrollCollapseRafRef = useRef(0);

  /** Mobile: tie top bar + main offset to scroll over `MOBILE_SHELL_TOPBAR_PUSH_PX` px (fully collapsed at end of range). */
  const applyMobileScrollCollapse = useCallback(() => {
    const mainEl = mainRef.current;
    const topbarEl = topbarWrapRef.current;
    if (!mainEl || !topbarEl) return;

    if (typeof window !== "undefined" && window.matchMedia("(min-width: 768px)").matches) {
      topbarEl.style.removeProperty("--topbar-ty");
      mainEl.style.removeProperty("--main-ty");
      topbarEl.style.removeProperty("pointer-events");
      return;
    }

    const push = MOBILE_SHELL_TOPBAR_PUSH_PX;
    const st = Math.max(0, mainEl.scrollTop);
    const collapse = Math.min(1, st / push);
    const sat = "var(--sat)";
    topbarEl.style.setProperty("--topbar-ty", `calc(${sat} - ${collapse * push}px)`);
    mainEl.style.setProperty("--main-ty", `calc(${sat} + ${(1 - collapse) * push}px)`);
    topbarEl.style.pointerEvents = collapse > 0.98 ? "none" : "";
  }, []);

  const scheduleApplyMobileScrollCollapse = useCallback(() => {
    if (scrollCollapseRafRef.current) return;
    scrollCollapseRafRef.current = requestAnimationFrame(() => {
      scrollCollapseRafRef.current = 0;
      applyMobileScrollCollapse();
    });
  }, [applyMobileScrollCollapse]);

  useEffect(() => {
    const el = mainRef.current;
    if (!el) return;
    applyMobileScrollCollapse();
    el.addEventListener("scroll", scheduleApplyMobileScrollCollapse, { passive: true });
    return () => {
      el.removeEventListener("scroll", scheduleApplyMobileScrollCollapse);
      if (scrollCollapseRafRef.current) {
        cancelAnimationFrame(scrollCollapseRafRef.current);
        scrollCollapseRafRef.current = 0;
      }
    };
  }, [pathname, applyMobileScrollCollapse, scheduleApplyMobileScrollCollapse]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(min-width: 768px)");
    const onChange = () => {
      applyMobileScrollCollapse();
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [applyMobileScrollCollapse]);

  return (
    <div
      suppressHydrationWarning
      className="relative h-dvh max-h-dvh w-full overflow-hidden bg-white md:bg-[var(--background)]"
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
        ref={topbarWrapRef}
        suppressHydrationWarning
        className="fixed right-1 top-1 z-30 min-w-0 rounded-[4px] bg-white py-1 max-md:right-0 max-md:top-0 max-md:rounded-none max-md:py-0 max-md:shadow-none md:shadow-[0_1px_0_0_rgba(0,0,0,0.03)] md:transition-[left] md:duration-200 md:ease-out max-md:transform-gpu max-md:backface-hidden max-md:transition-none left-1 max-md:left-0 md:left-[length:var(--shell-left)] max-md:translate-y-[var(--topbar-ty)] md:translate-y-0"
        style={{ ["--topbar-ty" as string]: "var(--sat)" } as CSSProperties}
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
        className="fixed right-1 z-0 min-w-0 overflow-y-auto overscroll-y-contain rounded-[4px] bg-white top-1 max-md:right-0 max-md:top-0 max-md:rounded-none max-md:bottom-0 max-md:pb-[var(--mobile-bottom-nav-main-clearance)] md:top-[74px] md:transition-[left] md:duration-200 md:ease-out max-md:transform-gpu max-md:backface-hidden max-md:transition-none left-1 max-md:left-0 md:left-[length:var(--shell-left)] md:bottom-1 max-md:translate-y-[var(--main-ty)] md:translate-y-0"
        style={
          {
            ["--main-ty" as string]: "calc(var(--mobile-topbar-push) + var(--sat))",
          } as CSSProperties
        }
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
