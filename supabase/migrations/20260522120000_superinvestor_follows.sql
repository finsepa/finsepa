-- Per-user followed superinvestor profile paths (e.g. /superinvestors/berkshire-hathaway).
CREATE TABLE IF NOT EXISTS public.superinvestor_follows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  profile_path text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT superinvestor_follows_user_path_unique UNIQUE (user_id, profile_path)
);

CREATE INDEX IF NOT EXISTS superinvestor_follows_user_id_idx
  ON public.superinvestor_follows (user_id);

ALTER TABLE public.superinvestor_follows ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users select own superinvestor follows" ON public.superinvestor_follows;
CREATE POLICY "Users select own superinvestor follows"
  ON public.superinvestor_follows FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users insert own superinvestor follows" ON public.superinvestor_follows;
CREATE POLICY "Users insert own superinvestor follows"
  ON public.superinvestor_follows FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users delete own superinvestor follows" ON public.superinvestor_follows;
CREATE POLICY "Users delete own superinvestor follows"
  ON public.superinvestor_follows FOR DELETE
  USING (auth.uid() = user_id);
