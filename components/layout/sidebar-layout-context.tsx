"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import {
  readSidebarCollapsedPreference,
  SIDEBAR_COLLAPSED_PREFERENCE_KEY,
} from "@/lib/layout/sidebar-collapsed-preference";

export const SIDEBAR_OUTER_EXPANDED_PX = 248;
export const SIDEBAR_OUTER_COLLAPSED_PX = 72;

export const SIDEBAR_MOTION_MS = 280;
export const SIDEBAR_MOTION_EASE = "cubic-bezier(0.33, 1, 0.68, 1)";

/** Shared width/position transitions for sidebar shell + rail. */
export const SIDEBAR_WIDTH_MOTION_CLASS =
  "transition-[width,left] duration-[280ms] ease-[cubic-bezier(0.33,1,0.68,1)] motion-reduce:transition-none";

/** Labels, section headers, and row layout inside the rail. */
export const SIDEBAR_CONTENT_MOTION_CLASS =
  "transition-[opacity,max-width,max-height,margin,padding,gap] duration-[280ms] ease-[cubic-bezier(0.33,1,0.68,1)] motion-reduce:transition-none";

type SidebarLayoutContextValue = {
  collapsed: boolean;
  setCollapsed: (value: boolean) => void;
  toggleCollapsed: () => void;
};

const SidebarLayoutContext = createContext<SidebarLayoutContextValue | null>(null);

function writeSidebarCollapsedCookie(value: boolean) {
  if (typeof document === "undefined") return;
  const encoded = value ? "1" : "0";
  document.cookie = `${SIDEBAR_COLLAPSED_PREFERENCE_KEY}=${encoded};path=/;max-age=${60 * 60 * 24 * 365};SameSite=Lax`;
}

function persistSidebarCollapsedPreference(value: boolean) {
  try {
    localStorage.setItem(SIDEBAR_COLLAPSED_PREFERENCE_KEY, value ? "1" : "0");
  } catch {
    /* ignore */
  }
  writeSidebarCollapsedCookie(value);
}

export function SidebarLayoutProvider({
  children,
  initialCollapsed = false,
}: {
  children: ReactNode;
  /** From server cookie so SSR and the first client render agree (avoids hydration mismatch). */
  initialCollapsed?: boolean;
}) {
  const [collapsed, setCollapsedState] = useState(initialCollapsed);

  useEffect(() => {
    try {
      const fromStorage = readSidebarCollapsedPreference(
        localStorage.getItem(SIDEBAR_COLLAPSED_PREFERENCE_KEY),
      );
      if (fromStorage !== initialCollapsed) {
        setCollapsedState(fromStorage);
        writeSidebarCollapsedCookie(fromStorage);
      }
    } catch {
      /* ignore */
    }
  }, [initialCollapsed]);

  const persist = useCallback((value: boolean) => {
    persistSidebarCollapsedPreference(value);
  }, []);

  const setCollapsed = useCallback(
    (value: boolean) => {
      setCollapsedState(value);
      persist(value);
    },
    [persist],
  );

  const toggleCollapsed = useCallback(() => {
    setCollapsedState((c) => {
      const next = !c;
      persist(next);
      return next;
    });
  }, [persist]);

  const value = useMemo(
    () => ({ collapsed, setCollapsed, toggleCollapsed }),
    [collapsed, setCollapsed, toggleCollapsed],
  );

  return <SidebarLayoutContext.Provider value={value}>{children}</SidebarLayoutContext.Provider>;
}

export function useSidebarLayout() {
  const ctx = useContext(SidebarLayoutContext);
  if (!ctx) {
    throw new Error("useSidebarLayout must be used within SidebarLayoutProvider");
  }
  return ctx;
}
