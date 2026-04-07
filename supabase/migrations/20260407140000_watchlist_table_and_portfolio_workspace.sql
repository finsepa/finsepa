-- Core watchlist table (referenced by count_watchlist_for_ticker RPC). Safe to run if objects already exist.
CREATE TABLE IF NOT EXISTS public.watchlist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  ticker text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT watchlist_user_ticker_unique UNIQUE (user_id, ticker)
);

CREATE INDEX IF NOT EXISTS watchlist_user_id_idx ON public.watchlist (user_id);

ALTER TABLE public.watchlist ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users select own watchlist rows" ON public.watchlist;
CREATE POLICY "Users select own watchlist rows"
  ON public.watchlist FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users insert own watchlist rows" ON public.watchlist;
CREATE POLICY "Users insert own watchlist rows"
  ON public.watchlist FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users delete own watchlist rows" ON public.watchlist;
CREATE POLICY "Users delete own watchlist rows"
  ON public.watchlist FOR DELETE
  USING (auth.uid() = user_id);

-- Single JSON blob per user for portfolio workspace (portfolios, holdings, transactions).
CREATE TABLE IF NOT EXISTS public.portfolio_workspace (
  user_id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  state jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.portfolio_workspace ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own portfolio workspace" ON public.portfolio_workspace;
CREATE POLICY "Users manage own portfolio workspace"
  ON public.portfolio_workspace FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
