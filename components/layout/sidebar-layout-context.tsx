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

const STORAGE_KEY = "finsepa-sidebar-collapsed";

export const SIDEBAR_OUTER_EXPANDED_PX = 248;
export const SIDEBAR_OUTER_COLLAPSED_PX = 72;

type SidebarLayoutContextValue = {
  collapsed: boolean;
  setCollapsed: (value: boolean) => void;
  toggleCollapsed: () => void;
};

const SidebarLayoutContext = createContext<SidebarLayoutContextValue | null>(null);

export function SidebarLayoutProvider({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsedState] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(STORAGE_KEY) === "1") {
        setCollapsedState(true);
      }
    } catch {
      /* ignore */
    }
  }, []);

  const persist = useCallback((value: boolean) => {
    try {
      localStorage.setItem(STORAGE_KEY, value ? "1" : "0");
    } catch {
      /* ignore */
    }
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
