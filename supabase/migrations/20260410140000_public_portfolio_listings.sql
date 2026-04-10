-- Community-visible snapshots when a portfolio is set to Public (updated from the client after workspace changes).
CREATE TABLE IF NOT EXISTS public.public_portfolio_listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  portfolio_id text NOT NULL,
  display_name text NOT NULL,
  metrics jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT public_portfolio_listings_user_portfolio_unique UNIQUE (user_id, portfolio_id)
);

CREATE INDEX IF NOT EXISTS public_portfolio_listings_updated_at_idx
  ON public.public_portfolio_listings (updated_at DESC);

ALTER TABLE public.public_portfolio_listings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users read all public portfolio listings" ON public.public_portfolio_listings;
CREATE POLICY "Authenticated users read all public portfolio listings"
  ON public.public_portfolio_listings FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Users insert own public portfolio listing" ON public.public_portfolio_listings;
CREATE POLICY "Users insert own public portfolio listing"
  ON public.public_portfolio_listings FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users update own public portfolio listing" ON public.public_portfolio_listings;
CREATE POLICY "Users update own public portfolio listing"
  ON public.public_portfolio_listings FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users delete own public portfolio listing" ON public.public_portfolio_listings;
CREATE POLICY "Users delete own public portfolio listing"
  ON public.public_portfolio_listings FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
