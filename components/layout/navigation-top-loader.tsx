"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

const SHOW_DELAY_MS = 100;
const DONE_HOLD_MS = 280;
const Z_BAR = 100;

function routeKey(pathname: string, search: string) {
  return `${pathname}${search ? `?${search}` : ""}`;
}

function isInternalAppLink(a: HTMLAnchorElement): boolean {
  if (a.target === "_blank" || a.hasAttribute("download")) return false;
  const href = a.getAttribute("href");
  if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) return false;
  try {
    const url = new URL(href, window.location.origin);
    if (url.origin !== window.location.origin) return false;
    return true;
  } catch {
    return false;
  }
}

/**
 * Slim top bar during App Router navigations — starts on in-app link intent, completes when the route URL settles.
 * Uses pathname + searchParams only (not arbitrary client state). Delayed show reduces flicker on very fast transitions.
 */
export function NavigationTopLoader() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams?.toString() ?? "";
  const key = routeKey(pathname, search);

  const [visible, setVisible] = useState(false);
  const [progress, setProgress] = useState(0);

  const prevKeyRef = useRef(key);
  const firstPaintRef = useRef(true);
  const showTimerRef = useRef<number | null>(null);
  const creepTimerRef = useRef<number | null>(null);
  const doneTimerRef = useRef<number | null>(null);
  const activeRef = useRef(false);

  const clearCreep = useCallback(() => {
    if (creepTimerRef.current) {
      clearTimeout(creepTimerRef.current);
      creepTimerRef.current = null;
    }
  }, []);

  const clearShowDelay = useCallback(() => {
    if (showTimerRef.current) {
      clearTimeout(showTimerRef.current);
      showTimerRef.current = null;
    }
  }, []);

  const finishBar = useCallback(() => {
    clearCreep();
    clearShowDelay();
    if (!activeRef.current) return;
    activeRef.current = false;
    setProgress(1);
    if (doneTimerRef.current) clearTimeout(doneTimerRef.current);
    doneTimerRef.current = window.setTimeout(() => {
      setVisible(false);
      setProgress(0);
      doneTimerRef.current = null;
    }, DONE_HOLD_MS);
  }, [clearCreep, clearShowDelay]);

  const startBar = useCallback(() => {
    clearShowDelay();
    clearCreep();
    if (doneTimerRef.current) {
      clearTimeout(doneTimerRef.current);
      doneTimerRef.current = null;
    }
    activeRef.current = true;
    setVisible(true);
    setProgress(0.08);
    const creep = () => {
      creepTimerRef.current = window.setTimeout(() => {
        if (!activeRef.current) return;
        setProgress((p) => {
          const cap = 0.92;
          const delta = 0.04 + Math.random() * 0.06;
          return Math.min(p + delta, cap);
        });
        creep();
      }, 380);
    };
    creep();
  }, [clearCreep, clearShowDelay]);

  const scheduleStart = useCallback(() => {
    clearShowDelay();
    showTimerRef.current = window.setTimeout(() => {
      showTimerRef.current = null;
      startBar();
    }, SHOW_DELAY_MS);
  }, [clearShowDelay, startBar]);

  const runProgrammaticSweep = useCallback(() => {
    if (doneTimerRef.current) {
      clearTimeout(doneTimerRef.current);
      doneTimerRef.current = null;
    }
    activeRef.current = true;
    setVisible(true);
    setProgress(0.65);
    requestAnimationFrame(() => {
      setProgress(1);
      doneTimerRef.current = window.setTimeout(() => {
        setVisible(false);
        setProgress(0);
        activeRef.current = false;
        doneTimerRef.current = null;
      }, 220);
    });
  }, []);

  /** Fire when pathname/search URL settles (navigation done). */
  useEffect(() => {
    if (firstPaintRef.current) {
      firstPaintRef.current = false;
      prevKeyRef.current = key;
      return;
    }
    if (prevKeyRef.current === key) return;
    prevKeyRef.current = key;

    if (showTimerRef.current) {
      clearShowDelay();
      return;
    }

    if (activeRef.current) {
      // Schedule state updates outside the effect body to avoid cascading renders.
      queueMicrotask(() => finishBar());
      return;
    }

    queueMicrotask(() => runProgrammaticSweep());
  }, [key, clearShowDelay, finishBar, runProgrammaticSweep]);

  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const el = (e.target as Element | null)?.closest?.("a");
      if (!el || !(el instanceof HTMLAnchorElement)) return;
      if (!isInternalAppLink(el)) return;
      try {
        const href = el.getAttribute("href");
        if (!href) return;
        const url = new URL(href, window.location.origin);
        const next = routeKey(url.pathname, url.search.slice(1));
        if (next === routeKey(pathname, search)) return;
      } catch {
        return;
      }
      scheduleStart();
    };

    const onPopState = () => {
      scheduleStart();
    };

    document.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("popstate", onPopState);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("popstate", onPopState);
      clearShowDelay();
      clearCreep();
      if (doneTimerRef.current) clearTimeout(doneTimerRef.current);
    };
  }, [pathname, search, scheduleStart, clearShowDelay, clearCreep]);

  if (!visible && progress === 0) return null;

  return (
    <div
      className="pointer-events-none fixed top-0 right-0 left-0 overflow-hidden"
      style={{ zIndex: Z_BAR, height: 2, margin: 0, padding: 0 }}
      aria-hidden
    >
      <div
        className="h-full origin-left rounded-none bg-[#09090B]"
        style={{
          transform: `scaleX(${Math.min(1, Math.max(0, progress))})`,
          transition:
            progress >= 1
              ? "transform 180ms cubic-bezier(0.22, 1, 0.36, 1), opacity 180ms ease"
              : "transform 120ms ease-out",
          opacity: 0.88,
        }}
      />
    </div>
  );
}
