"use client";

import type { RefObject } from "react";
import { useCallback, useEffect, useState } from "react";

const DESKTOP_SHELL_MQ = "(min-width: 768px)";

export type ShellScrollRoot = HTMLElement | Window | null;

/** Desktop: shell `<main>`; mobile: `window` (document scroll for Safari chrome collapse). */
export function useShellScrollRoot(mainRef: RefObject<HTMLElement | null>): ShellScrollRoot {
  const [root, setRoot] = useState<ShellScrollRoot>(null);

  const resolve = useCallback(() => {
    if (typeof window === "undefined") return;
    const useMain = window.matchMedia(DESKTOP_SHELL_MQ).matches;
    setRoot(useMain ? mainRef.current : window);
  }, [mainRef]);

  useEffect(() => {
    resolve();
    const mq = window.matchMedia(DESKTOP_SHELL_MQ);
    const onChange = () => resolve();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [resolve]);

  return root;
}

export function shellScrollTop(root: ShellScrollRoot): number {
  if (root == null) return 0;
  if (root === window) return window.scrollY;
  return (root as HTMLElement).scrollTop;
}

export function shellScrollToTop(root: ShellScrollRoot, behavior: ScrollBehavior = "smooth") {
  if (root == null) return;
  if (root === window) {
    window.scrollTo({ top: 0, behavior });
    return;
  }
  (root as HTMLElement).scrollTo({ top: 0, behavior });
}
