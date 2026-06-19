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

/** Reveals the topbar progression blur only after the user scrolls down on mobile. */
export function useMobileTopbarScrollBlur(): void {
  const pathname = usePathname();
  const rafRef = useRef(0);

  useEffect(() => {
    syncMobileTopbarScrollActiveClass(false, false);
    if (typeof window !== "undefined") {
      const mq = window.matchMedia(MOBILE_SHELL_MQ);
      syncMobileTopbarScrollActiveClass(
        window.scrollY > TOPBAR_BLUR_SCROLL_THRESHOLD_PX,
        mq.matches,
      );
    }
  }, [pathname]);

  useEffect(() => {
    const mq = window.matchMedia(MOBILE_SHELL_MQ);

    const apply = () => {
      if (!mq.matches) {
        syncMobileTopbarScrollActiveClass(false, false);
        return;
      }
      syncMobileTopbarScrollActiveClass(
        window.scrollY > TOPBAR_BLUR_SCROLL_THRESHOLD_PX,
        true,
      );
    };

    const onScroll = () => {
      if (rafRef.current) return;
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = 0;
        apply();
      });
    };

    const onMqChange = () => apply();

    apply();
    window.addEventListener("scroll", onScroll, { passive: true });
    mq.addEventListener("change", onMqChange);
    return () => {
      window.removeEventListener("scroll", onScroll);
      mq.removeEventListener("change", onMqChange);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      syncMobileTopbarScrollActiveClass(false, false);
    };
  }, []);
}
