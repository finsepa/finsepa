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
import { toast } from "sonner";

import {
  EMPTY_FREE_PLAN_SELECTION,
  type FreePlanSelectionRow,
} from "@/lib/account/free-plan-selection-client";
import {
  entitlementsForTier,
  type PlanEntitlements,
  type PlanTier,
} from "@/lib/account/plan-entitlements";

export type PlanAccessValue = PlanEntitlements & {
  selection: FreePlanSelectionRow;
  selectionReady: boolean;
  refreshPlan: () => Promise<void>;
  ackFreeLimits: () => Promise<boolean>;
  selectFreePortfolio: (portfolioId: string) => Promise<boolean>;
  selectFreeWatchlist: (watchlistId: string) => Promise<boolean>;
  /** Free: one-time limits intro when over quota. */
  shouldShowFreeLimitsIntro: boolean;
  /** Free: must pick portfolio (over limit, not locked). */
  needsFreePortfolioPick: boolean;
  /** Free: must pick watchlist (over limit, not locked). */
  needsFreeWatchlistPick: boolean;
  freeActivePortfolioId: string | null;
  freeActiveWatchlistId: string | null;
  setOverLimitCounts: (counts: {
    realPortfolios?: number;
    watchlists?: number;
    /** Frozen on Free when > 0 — used for free-limits intro copy. */
    brokeragePortfolios?: number;
    /** Free: true when free_active_portfolio_id points at an existing manual book. */
    freeActiveSlotOccupied?: boolean;
  }) => void;
};

const PlanAccessContext = createContext<PlanAccessValue | null>(null);

export function PlanAccessProvider({
  children,
  initial,
}: {
  children: ReactNode;
  initial: PlanEntitlements;
}) {
  const [entitlements, setEntitlements] = useState<PlanEntitlements>(initial);
  const [selection, setSelection] = useState<FreePlanSelectionRow>(EMPTY_FREE_PLAN_SELECTION);
  const [selectionReady, setSelectionReady] = useState(false);
  /** True only after /api/account/plan succeeds — blocks Free intro on a stale/wrong SSR tier. */
  const [planFetchOk, setPlanFetchOk] = useState(false);
  const [counts, setCounts] = useState({
    realPortfolios: 0,
    watchlists: 0,
    brokeragePortfolios: 0,
    freeActiveSlotOccupied: false,
  });

  const applyGate = useCallback((tier: PlanTier, topbarTrialDaysLeft: number | null) => {
    setEntitlements(entitlementsForTier(tier, topbarTrialDaysLeft));
  }, []);

  const refreshPlan = useCallback(async () => {
    try {
      const res = await fetch("/api/account/plan", { method: "GET", cache: "no-store" });
      if (!res.ok) {
        // Keep selectionReady for pick modals that already rely on SSR tier, but do not
        // mark planFetchOk — Free-limits intro must not open on a failed plan refresh.
        setSelectionReady(true);
        return;
      }
      const data = (await res.json()) as {
        tier: PlanTier;
        topbarTrialDaysLeft: number | null;
        selection: FreePlanSelectionRow;
      };
      applyGate(data.tier, data.topbarTrialDaysLeft);
      if (data.selection) setSelection(data.selection);
      setPlanFetchOk(true);
      setSelectionReady(true);
    } catch {
      setSelectionReady(true);
    }
  }, [applyGate]);

  useEffect(() => {
    void refreshPlan();
  }, [refreshPlan]);

  const ackFreeLimits = useCallback(async () => {
    // Optimistic dismiss so the button always feels responsive.
    setSelection((s) => ({
      ...s,
      free_plan_limits_acked_at: s.free_plan_limits_acked_at ?? new Date().toISOString(),
    }));
    try {
      const res = await fetch("/api/account/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ackLimits: true }),
      });
      if (!res.ok) {
        toast.error("Couldn’t save. Try Continue on Free again.");
        setSelection((s) => ({ ...s, free_plan_limits_acked_at: null }));
        return false;
      }
      const data = (await res.json()) as { selection?: FreePlanSelectionRow };
      if (data.selection) setSelection(data.selection);
      return true;
    } catch {
      toast.error("Couldn’t save. Try Continue on Free again.");
      setSelection((s) => ({ ...s, free_plan_limits_acked_at: null }));
      return false;
    }
  }, []);

  const selectFreePortfolio = useCallback(async (portfolioId: string) => {
    const res = await fetch("/api/account/plan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ freeActivePortfolioId: portfolioId, lockPortfolioSelection: true }),
    });
    if (!res.ok) return false;
    const data = (await res.json()) as { selection?: FreePlanSelectionRow };
    if (data.selection) setSelection(data.selection);
    return true;
  }, []);

  const selectFreeWatchlist = useCallback(async (watchlistId: string) => {
    const res = await fetch("/api/account/plan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ freeActiveWatchlistId: watchlistId, lockWatchlistSelection: true }),
    });
    if (!res.ok) return false;
    const data = (await res.json()) as { selection?: FreePlanSelectionRow };
    if (data.selection) setSelection(data.selection);
    return true;
  }, []);

  const setOverLimitCounts = useCallback(
    (next: {
      realPortfolios?: number;
      watchlists?: number;
      brokeragePortfolios?: number;
      freeActiveSlotOccupied?: boolean;
    }) => {
      setCounts((prev) => {
        const realPortfolios = next.realPortfolios ?? prev.realPortfolios;
        const watchlists = next.watchlists ?? prev.watchlists;
        const brokeragePortfolios = next.brokeragePortfolios ?? prev.brokeragePortfolios;
        const freeActiveSlotOccupied =
          next.freeActiveSlotOccupied ?? prev.freeActiveSlotOccupied;
        if (
          realPortfolios === prev.realPortfolios &&
          watchlists === prev.watchlists &&
          brokeragePortfolios === prev.brokeragePortfolios &&
          freeActiveSlotOccupied === prev.freeActiveSlotOccupied
        ) {
          return prev;
        }
        return { realPortfolios, watchlists, brokeragePortfolios, freeActiveSlotOccupied };
      });
    },
    [],
  );

  const value = useMemo((): PlanAccessValue => {
    const maxP = entitlements.maxRealPortfolios;
    const maxW = entitlements.maxWatchlists;
    const overPortfolios = maxP != null && counts.realPortfolios > maxP;
    const overWatchlists = maxW != null && counts.watchlists > maxW;

    const canCreatePortfolio =
      entitlements.isPro || entitlements.isTrial
        ? true
        : counts.freeActiveSlotOccupied
          ? false
          : // Stale Free lock (active deleted): allow a replacement manual.
            selection.free_portfolio_selection_locked
            ? true
            : maxP == null
              ? true
              : counts.realPortfolios < maxP;

    const canCreateWatchlist =
      entitlements.isPro || entitlements.isTrial
        ? true
        : maxW == null
          ? true
          : counts.watchlists < maxW;

    const needsFreePortfolioPick =
      entitlements.isFree && overPortfolios && !selection.free_portfolio_selection_locked;

    const needsFreeWatchlistPick =
      entitlements.isFree && overWatchlists && !selection.free_watchlist_selection_locked;

    const shouldShowFreeLimitsIntro =
      entitlements.isFree &&
      selectionReady &&
      planFetchOk &&
      !selection.free_plan_limits_acked_at &&
      (overPortfolios || overWatchlists || counts.brokeragePortfolios > 0);

    return {
      ...entitlements,
      canCreatePortfolio,
      canCreateWatchlist,
      canConnectBrokerage: entitlements.canConnectBrokerage,
      canUseActivityAlerts: entitlements.canUseActivityAlerts,
      selection,
      selectionReady,
      refreshPlan,
      ackFreeLimits,
      selectFreePortfolio,
      selectFreeWatchlist,
      shouldShowFreeLimitsIntro,
      needsFreePortfolioPick,
      needsFreeWatchlistPick,
      freeActivePortfolioId: selection.free_active_portfolio_id,
      freeActiveWatchlistId: selection.free_active_watchlist_id,
      setOverLimitCounts,
    };
  }, [
    entitlements,
    selection,
    selectionReady,
    planFetchOk,
    counts,
    refreshPlan,
    ackFreeLimits,
    selectFreePortfolio,
    selectFreeWatchlist,
    setOverLimitCounts,
  ]);

  return <PlanAccessContext.Provider value={value}>{children}</PlanAccessContext.Provider>;
}

export function usePlanAccess(): PlanAccessValue {
  const ctx = useContext(PlanAccessContext);
  if (!ctx) {
    throw new Error("usePlanAccess must be used within PlanAccessProvider");
  }
  return ctx;
}

export function usePlanAccessOptional(): PlanAccessValue | null {
  return useContext(PlanAccessContext);
}
