"use client";

import type { RefObject } from "react";
import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import { ArrowUp } from "@phosphor-icons/react";

import { MAIN_SHELL_SCROLL_THRESHOLD_PX } from "@/lib/layout/main-shell-scroll-threshold";
import {
  shellScrollToTop,
  shellScrollTop,
  useShellScrollRoot,
} from "@/lib/layout/use-shell-scroll-root";
import { cn } from "@/lib/utils";

type MainScrollToTopProps = {
  /** App shell scroll container on desktop; mobile uses document (`window`) scroll. */
  scrollRootRef: RefObject<HTMLElement | null>;
};

export function MainScrollToTop({ scrollRootRef }: MainScrollToTopProps) {
  const pathname = usePathname();
  const scrollRoot = useShellScrollRoot(scrollRootRef);
  const [visible, setVisible] = useState(false);
  const [portalReady, setPortalReady] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setPortalReady(true));
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    if (scrollRoot == null) return;

    const onScroll = () => {
      setVisible(shellScrollTop(scrollRoot) > MAIN_SHELL_SCROLL_THRESHOLD_PX);
    };

    const raf = requestAnimationFrame(onScroll);
    scrollRoot.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      scrollRoot.removeEventListener("scroll", onScroll);
    };
  }, [pathname, scrollRoot]);

  const scrollToTop = useCallback(() => {
    shellScrollToTop(scrollRoot);
  }, [scrollRoot]);

  const button = (
    <button
      type="button"
      aria-label="Back to top"
      tabIndex={visible ? 0 : -1}
      onClick={scrollToTop}
      className={cn(
        "fixed z-[35] flex h-12 w-12 items-center justify-center rounded-full border border-[#E4E4E7] bg-white text-[#09090B] shadow-sm transition-opacity duration-200",
        "max-md:bottom-[var(--mobile-bottom-nav-fab-bottom)] right-3 md:bottom-6 md:right-6",
        visible ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0",
      )}
    >
      <ArrowUp className="h-5 w-5 shrink-0" weight="bold" aria-hidden />
    </button>
  );

  if (!portalReady || typeof document === "undefined") {
    return null;
  }

  return createPortal(button, document.body);
}
