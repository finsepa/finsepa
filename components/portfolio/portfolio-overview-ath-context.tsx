"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

/** Mirrors Total profit card (period All) — lifetime return % on total equity cost basis; null when unavailable. */
export type PortfolioOverviewAthSnapshot = {
  /** False while overview-market fetch is in flight (holdings non-empty). */
  marketReady: boolean;
  athReturnPct: number | null;
};

type Ctx = {
  snapshot: PortfolioOverviewAthSnapshot;
  setAthSnapshot: (s: PortfolioOverviewAthSnapshot) => void;
};

const PortfolioOverviewAthContext = createContext<Ctx | null>(null);

export function PortfolioOverviewAthProvider({ children }: { children: ReactNode }) {
  const [snapshot, setSnapshotState] = useState<PortfolioOverviewAthSnapshot>({
    marketReady: false,
    athReturnPct: null,
  });
  const setAthSnapshot = useCallback((s: PortfolioOverviewAthSnapshot) => {
    setSnapshotState(s);
  }, []);
  const value = useMemo(() => ({ snapshot, setAthSnapshot }), [snapshot, setAthSnapshot]);
  return (
    <PortfolioOverviewAthContext.Provider value={value}>{children}</PortfolioOverviewAthContext.Provider>
  );
}

export function usePortfolioOverviewAthPublisher(): (s: PortfolioOverviewAthSnapshot) => void {
  const ctx = useContext(PortfolioOverviewAthContext);
  if (!ctx) {
    throw new Error("usePortfolioOverviewAthPublisher must be used within PortfolioOverviewAthProvider");
  }
  return ctx.setAthSnapshot;
}

/** `null` if no provider (e.g. table used in isolation) — caller may fall back to local metrics. */
export function usePortfolioOverviewAthReader(): PortfolioOverviewAthSnapshot | null {
  const ctx = useContext(PortfolioOverviewAthContext);
  return ctx?.snapshot ?? null;
}
