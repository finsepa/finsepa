"use client";

import type { CSSProperties, ReactNode } from "react";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
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
import { MAIN_SHELL_SCROLL_THRESHOLD_PX } from "@/lib/layout/main-shell-scroll-threshold";

function ProtectedAppChrome({
  children,
  userInitials,
  avatarUrl,
  userDisplayName,
  platformTrialDaysLeft,
}: {
  children: ReactNode;
  userInitials: string;
  avatarUrl: string | null;
  userDisplayName: string;
  platformTrialDaysLeft: number | null;
}) {
  const { collapsed } = useSidebarLayout();
  const outerPx = collapsed ? SIDEBAR_OUTER_COLLAPSED_PX : SIDEBAR_OUTER_EXPANDED_PX;
  const leftOffset = `${outerPx}px`;

  const mainRef = useRef<HTMLElement>(null);
  const pathname = usePathname();
  const [mobileTopbarHidden, setMobileTopbarHidden] = useState(false);

  const syncMobileTopbarFromMainScroll = useCallback(() => {
    const el = mainRef.current;
    if (!el) return;
    if (typeof window !== "undefined" && window.matchMedia("(min-width: 768px)").matches) {
      setMobileTopbarHidden(false);
      return;
    }
    const st = el.scrollTop;
    if (st <= 0) setMobileTopbarHidden(false);
    else if (st > MAIN_SHELL_SCROLL_THRESHOLD_PX) setMobileTopbarHidden(true);
  }, []);

  useEffect(() => {
    const el = mainRef.current;
    if (!el) return;
    const raf = requestAnimationFrame(() => syncMobileTopbarFromMainScroll());
    el.addEventListener("scroll", syncMobileTopbarFromMainScroll, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      el.removeEventListener("scroll", syncMobileTopbarFromMainScroll);
    };
  }, [pathname, syncMobileTopbarFromMainScroll]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(min-width: 768px)");
    const onChange = () => {
      if (mq.matches) setMobileTopbarHidden(false);
      else syncMobileTopbarFromMainScroll();
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [syncMobileTopbarFromMainScroll]);

  return (
    <div
      className="relative h-dvh max-h-dvh w-full overflow-hidden bg-[#E4E4E7]"
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
        className="fixed right-1 top-1 z-30 min-w-0 rounded-[4px] bg-white py-1 max-md:pb-0 shadow-[0_1px_0_0_rgba(0,0,0,0.03)] md:transition-[left] md:duration-200 md:ease-out max-md:transform-gpu max-md:transition-[transform] max-md:backface-hidden max-md:duration-300 max-md:ease-[cubic-bezier(0.4,0,0.2,1)] motion-reduce:max-md:duration-150 left-1 md:left-[length:var(--shell-left)] max-md:translate-y-[var(--topbar-ty)] md:translate-y-0"
        style={
          {
            "--topbar-ty": mobileTopbarHidden ? "-100%" : "var(--sat)",
            pointerEvents: mobileTopbarHidden ? "none" : undefined,
          } as CSSProperties
        }
      >
        <Topbar
          userInitials={userInitials}
          avatarUrl={avatarUrl}
          userDisplayName={userDisplayName}
          platformTrialDaysLeft={platformTrialDaysLeft}
        />
      </div>
      <main
        ref={mainRef}
        suppressHydrationWarning
        className="fixed right-1 z-0 min-w-0 overflow-y-auto rounded-[4px] bg-white top-1 md:top-[74px] md:transition-[left] md:duration-200 md:ease-out max-md:transform-gpu max-md:transition-[transform] max-md:backface-hidden max-md:duration-300 max-md:ease-[cubic-bezier(0.4,0,0.2,1)] motion-reduce:max-md:duration-150 left-1 md:left-[length:var(--shell-left)] max-md:bottom-[calc(4.25rem+var(--mobile-main-bottom-gap)+env(safe-area-inset-bottom,0px))] md:bottom-1 max-md:translate-y-[var(--main-ty)] md:translate-y-0"
        style={
          {
            "--main-ty": mobileTopbarHidden
              ? "var(--sat)"
              : "calc(var(--mobile-topbar-push) + var(--sat))",
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
  userInitials,
  avatarUrl,
  userDisplayName,
  platformTrialDaysLeft = null,
}: {
  children: ReactNode;
  userInitials: string;
  avatarUrl: string | null;
  userDisplayName: string;
  /** Days remaining in the platform free trial; shown in the top bar until the user subscribes. */
  platformTrialDaysLeft?: number | null;
}) {
  return (
    <SidebarLayoutProvider>
      <ProtectedAppChrome
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
