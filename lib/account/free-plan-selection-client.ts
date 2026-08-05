/** Client-safe empty free plan selection (no server-only deps). */
export type FreePlanSelectionRow = {
  free_active_portfolio_id: string | null;
  free_active_watchlist_id: string | null;
  free_portfolio_selection_locked: boolean;
  free_watchlist_selection_locked: boolean;
  free_plan_limits_acked_at: string | null;
};

export const EMPTY_FREE_PLAN_SELECTION: FreePlanSelectionRow = {
  free_active_portfolio_id: null,
  free_active_watchlist_id: null,
  free_portfolio_selection_locked: false,
  free_watchlist_selection_locked: false,
  free_plan_limits_acked_at: null,
};
