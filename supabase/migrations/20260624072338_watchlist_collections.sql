-- Multi-watchlist: named collections per user, tickers scoped to a collection.

CREATE TABLE IF NOT EXISTS public.watchlist_collections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  name text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT watchlist_collections_user_name_unique UNIQUE (user_id, name)
);

CREATE INDEX IF NOT EXISTS watchlist_collections_user_id_idx ON public.watchlist_collections (user_id);

ALTER TABLE public.watchlist_collections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users select own watchlist collections" ON public.watchlist_collections;
CREATE POLICY "Users select own watchlist collections"
  ON public.watchlist_collections FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users insert own watchlist collections" ON public.watchlist_collections;
CREATE POLICY "Users insert own watchlist collections"
  ON public.watchlist_collections FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users update own watchlist collections" ON public.watchlist_collections;
CREATE POLICY "Users update own watchlist collections"
  ON public.watchlist_collections FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users delete own watchlist collections" ON public.watchlist_collections;
CREATE POLICY "Users delete own watchlist collections"
  ON public.watchlist_collections FOR DELETE
  USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.watchlist_user_state (
  user_id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  active_collection_id uuid REFERENCES public.watchlist_collections (id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.watchlist_user_state ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users select own watchlist state" ON public.watchlist_user_state;
CREATE POLICY "Users select own watchlist state"
  ON public.watchlist_user_state FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users insert own watchlist state" ON public.watchlist_user_state;
CREATE POLICY "Users insert own watchlist state"
  ON public.watchlist_user_state FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users update own watchlist state" ON public.watchlist_user_state;
CREATE POLICY "Users update own watchlist state"
  ON public.watchlist_user_state FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

ALTER TABLE public.watchlist
  ADD COLUMN IF NOT EXISTS collection_id uuid REFERENCES public.watchlist_collections (id) ON DELETE CASCADE;

-- Backfill: one default collection per user that already has tickers.
DO $$
DECLARE
  r RECORD;
  coll_id uuid;
BEGIN
  FOR r IN SELECT DISTINCT user_id FROM public.watchlist WHERE collection_id IS NULL
  LOOP
    INSERT INTO public.watchlist_collections (user_id, name, sort_order)
    VALUES (r.user_id, 'Watchlist', 0)
    ON CONFLICT (user_id, name) DO UPDATE SET name = EXCLUDED.name
    RETURNING id INTO coll_id;

    IF coll_id IS NULL THEN
      SELECT id INTO coll_id
      FROM public.watchlist_collections
      WHERE user_id = r.user_id AND name = 'Watchlist'
      LIMIT 1;
    END IF;

    UPDATE public.watchlist
    SET collection_id = coll_id
    WHERE user_id = r.user_id AND collection_id IS NULL;

    INSERT INTO public.watchlist_user_state (user_id, active_collection_id)
    VALUES (r.user_id, coll_id)
    ON CONFLICT (user_id) DO UPDATE
      SET active_collection_id = COALESCE(public.watchlist_user_state.active_collection_id, EXCLUDED.active_collection_id),
          updated_at = now();
  END LOOP;
END $$;

ALTER TABLE public.watchlist
  ALTER COLUMN collection_id SET NOT NULL;

ALTER TABLE public.watchlist DROP CONSTRAINT IF EXISTS watchlist_user_ticker_unique;

ALTER TABLE public.watchlist
  ADD CONSTRAINT watchlist_collection_ticker_unique UNIQUE (collection_id, ticker);

CREATE INDEX IF NOT EXISTS watchlist_collection_id_idx ON public.watchlist (collection_id);

-- Count distinct users watching a ticker (not per-collection rows).
CREATE OR REPLACE FUNCTION public.count_watchlist_for_ticker(p_ticker text)
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(DISTINCT user_id)::bigint
  FROM public.watchlist
  WHERE ticker = upper(trim(p_ticker));
$$;

REVOKE ALL ON FUNCTION public.count_watchlist_for_ticker(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.count_watchlist_for_ticker(text) TO anon, authenticated, service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.watchlist_collections TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.watchlist_user_state TO authenticated;
