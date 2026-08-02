-- Per-user recent search history (synced across devices / local ↔ production).

CREATE TABLE IF NOT EXISTS public.user_recent_searches (
  user_id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_recent_searches_items_is_array CHECK (jsonb_typeof(items) = 'array')
);

ALTER TABLE public.user_recent_searches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users select own recent searches" ON public.user_recent_searches;
CREATE POLICY "Users select own recent searches"
  ON public.user_recent_searches FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users insert own recent searches" ON public.user_recent_searches;
CREATE POLICY "Users insert own recent searches"
  ON public.user_recent_searches FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users update own recent searches" ON public.user_recent_searches;
CREATE POLICY "Users update own recent searches"
  ON public.user_recent_searches FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

GRANT SELECT, INSERT, UPDATE ON public.user_recent_searches TO authenticated;

COMMENT ON TABLE public.user_recent_searches IS
  'Newest-first recent search assets per user. Synced from the client; missing row = empty history.';
