"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

const MOBILE_SHELL_MQ = "(max-width: 767px)";
/** Blur extension kicks in once content begins moving under the fixed topbar. */
const TOPBAR_BLUR_SCROLL_THRESHOLD_PX = 12;

/** Synced with `globals.css` — progressive topbar blur below the chrome row. */
export const MOBILE_TOPBAR_SCROLL_ACTIVE_CLASS = "mobile-topbar-scroll-active";

function syncMobileTopbarScrollActiveClass(active: boolean, mobile: boolean) {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle(MOBILE_TOPBAR_SCROLL_ACTIVE_CLASS, mobile && active);
}

function readScrollY(): number {
  return window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0;
}

/** Reveals the topbar progression blur only after the user scrolls down on mobile. */
export function useMobileTopbarScrollBlur(): void {
  const pathname = usePathname();
  const rafRef = useRef(0);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const mq = window.matchMedia(MOBILE_SHELL_MQ);

    const apply = () => {
      if (!mq.matches) {
        syncMobileTopbarScrollActiveClass(false, false);
        return;
      }
      syncMobileTopbarScrollActiveClass(readScrollY() > TOPBAR_BLUR_SCROLL_THRESHOLD_PX, true);
    };

    const onScroll = () => {
      if (rafRef.current) return;
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = 0;
        apply();
      });
    };

    const onMqChange = () => apply();
    const onPageShow = () => apply();

    apply();
    const raf1 = requestAnimationFrame(apply);

    window.addEventListener("scroll", onScroll, { passive: true });
    document.addEventListener("scroll", onScroll, { passive: true, capture: true });
    window.addEventListener("pageshow", onPageShow);
    mq.addEventListener("change", onMqChange);

    return () => {
      cancelAnimationFrame(raf1);
      window.removeEventListener("scroll", onScroll);
      document.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("pageshow", onPageShow);
      mq.removeEventListener("change", onMqChange);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      syncMobileTopbarScrollActiveClass(false, false);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia(MOBILE_SHELL_MQ);
    syncMobileTopbarScrollActiveClass(
      mq.matches && readScrollY() > TOPBAR_BLUR_SCROLL_THRESHOLD_PX,
      mq.matches,
    );
    const raf = requestAnimationFrame(() => {
      syncMobileTopbarScrollActiveClass(
        mq.matches && readScrollY() > TOPBAR_BLUR_SCROLL_THRESHOLD_PX,
        mq.matches,
      );
    });
    return () => cancelAnimationFrame(raf);
  }, [pathname]);
}
