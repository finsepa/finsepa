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
  readWatchlistRailCollapsedPreference,
  WATCHLIST_RAIL_COLLAPSED_PREFERENCE_KEY,
} from "@/lib/layout/watchlist-rail-collapsed-preference";

/** Expanded rail width (Figma watchlist panel). */
export const WATCHLIST_PANEL_WIDTH_PX = 300;
/** Collapsed rail: header padding + ghost toggle only. */
export const WATCHLIST_RAIL_OUTER_COLLAPSED_PX = 56;
export const WATCHLIST_RAIL_OUTER_EXPANDED_PX = WATCHLIST_PANEL_WIDTH_PX;

export const WATCHLIST_RAIL_WIDTH_MOTION_CLASS =
  "transition-[width] duration-[280ms] ease-[cubic-bezier(0.33,1,0.68,1)] motion-reduce:transition-none";

type WatchlistRailLayoutContextValue = {
  /** Live preference (may update after hydration from localStorage). */
  collapsed: boolean;
  /** Server cookie value — stable for the first client render to match SSR. */
  initialCollapsed: boolean;
  setCollapsed: (value: boolean) => void;
  toggleCollapsed: () => void;
  outerWidthPx: number;
};

const WatchlistRailLayoutContext = createContext<WatchlistRailLayoutContextValue | null>(null);

function writeWatchlistRailCollapsedCookie(value: boolean) {
  if (typeof document === "undefined") return;
  const encoded = value ? "1" : "0";
  document.cookie = `${WATCHLIST_RAIL_COLLAPSED_PREFERENCE_KEY}=${encoded};path=/;max-age=${60 * 60 * 24 * 365};SameSite=Lax`;
}

function persistWatchlistRailCollapsedPreference(value: boolean) {
  try {
    localStorage.setItem(WATCHLIST_RAIL_COLLAPSED_PREFERENCE_KEY, value ? "1" : "0");
  } catch {
    /* ignore */
  }
  writeWatchlistRailCollapsedCookie(value);
}

export function WatchlistRailLayoutProvider({
  children,
  initialCollapsed = true,
}: {
  children: ReactNode;
  /** From server cookie so SSR and the first client render agree (avoids hydration mismatch). */
  initialCollapsed?: boolean;
}) {
  const [collapsed, setCollapsedState] = useState(initialCollapsed);
  const [hasHydrated, setHasHydrated] = useState(false);

  useEffect(() => {
    setHasHydrated(true);
    try {
      const raw = localStorage.getItem(WATCHLIST_RAIL_COLLAPSED_PREFERENCE_KEY);
      if (raw !== null) {
        const fromStorage = readWatchlistRailCollapsedPreference(raw);
        if (fromStorage !== initialCollapsed) {
          setCollapsedState(fromStorage);
          writeWatchlistRailCollapsedCookie(fromStorage);
        }
        return;
      }
      writeWatchlistRailCollapsedCookie(initialCollapsed);
    } catch {
      /* ignore */
    }
  }, [initialCollapsed]);

  const persist = useCallback((value: boolean) => {
    persistWatchlistRailCollapsedPreference(value);
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

  const layoutCollapsed = hasHydrated ? collapsed : initialCollapsed;

  const outerWidthPx = layoutCollapsed
    ? WATCHLIST_RAIL_OUTER_COLLAPSED_PX
    : WATCHLIST_RAIL_OUTER_EXPANDED_PX;

  const value = useMemo(
    () => ({
      collapsed: layoutCollapsed,
      initialCollapsed,
      setCollapsed,
      toggleCollapsed,
      outerWidthPx,
    }),
    [layoutCollapsed, initialCollapsed, setCollapsed, toggleCollapsed, outerWidthPx],
  );

  return (
    <WatchlistRailLayoutContext.Provider value={value}>{children}</WatchlistRailLayoutContext.Provider>
  );
}

export function useWatchlistRailLayout() {
  const ctx = useContext(WatchlistRailLayoutContext);
  if (!ctx) {
    throw new Error("useWatchlistRailLayout must be used within WatchlistRailLayoutProvider");
  }
  return ctx;
}
