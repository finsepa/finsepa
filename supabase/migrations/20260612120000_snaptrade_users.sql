-- SnapTrade credentials per Finsepa user. Server-only: no client RLS policies.
CREATE TABLE IF NOT EXISTS public.snaptrade_users (
  user_id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  snaptrade_user_id text NOT NULL,
  user_secret text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT snaptrade_users_snaptrade_user_id_unique UNIQUE (snaptrade_user_id)
);

ALTER TABLE public.snaptrade_users ENABLE ROW LEVEL SECURITY;

-- Block direct client access; API routes use the service role.
REVOKE ALL ON TABLE public.snaptrade_users FROM anon, authenticated;

CREATE INDEX IF NOT EXISTS snaptrade_users_updated_at_idx ON public.snaptrade_users (updated_at DESC);
