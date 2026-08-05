-- Free plan selection (post-trial). Once locked, user cannot switch free-active item without Pro.
ALTER TABLE public.billing_subscriptions
  ADD COLUMN IF NOT EXISTS free_active_portfolio_id text,
  ADD COLUMN IF NOT EXISTS free_active_watchlist_id text,
  ADD COLUMN IF NOT EXISTS free_portfolio_selection_locked boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS free_watchlist_selection_locked boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS free_plan_limits_acked_at timestamptz;

COMMENT ON COLUMN public.billing_subscriptions.free_active_portfolio_id IS
  'Free plan: portfolio the user may use at full access; null until chosen when over limit.';
COMMENT ON COLUMN public.billing_subscriptions.free_active_watchlist_id IS
  'Free plan: watchlist collection the user may use; null until chosen when over limit.';
COMMENT ON COLUMN public.billing_subscriptions.free_portfolio_selection_locked IS
  'True after user finalized free portfolio pick (cannot switch until Pro).';
COMMENT ON COLUMN public.billing_subscriptions.free_watchlist_selection_locked IS
  'True after user finalized free watchlist pick (cannot switch until Pro).';
COMMENT ON COLUMN public.billing_subscriptions.free_plan_limits_acked_at IS
  'When user dismissed post-trial Free limits intro modal.';
