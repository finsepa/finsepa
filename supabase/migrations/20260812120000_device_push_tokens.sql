-- APNs / FCM device tokens for earnings push alerts.

CREATE TABLE IF NOT EXISTS public.device_push_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  token text NOT NULL,
  platform text NOT NULL DEFAULT 'ios',
  environment text NOT NULL DEFAULT 'sandbox',
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT device_push_tokens_platform_check CHECK (platform IN ('ios', 'android')),
  CONSTRAINT device_push_tokens_environment_check CHECK (environment IN ('sandbox', 'production')),
  CONSTRAINT device_push_tokens_user_token_unique UNIQUE (user_id, token)
);

CREATE INDEX IF NOT EXISTS device_push_tokens_user_idx
  ON public.device_push_tokens (user_id);

CREATE INDEX IF NOT EXISTS device_push_tokens_token_idx
  ON public.device_push_tokens (token);

ALTER TABLE public.device_push_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users select own device tokens" ON public.device_push_tokens;
CREATE POLICY "Users select own device tokens"
  ON public.device_push_tokens FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users upsert own device tokens" ON public.device_push_tokens;
CREATE POLICY "Users upsert own device tokens"
  ON public.device_push_tokens FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users update own device tokens" ON public.device_push_tokens;
CREATE POLICY "Users update own device tokens"
  ON public.device_push_tokens FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users delete own device tokens" ON public.device_push_tokens;
CREATE POLICY "Users delete own device tokens"
  ON public.device_push_tokens FOR DELETE
  USING (auth.uid() = user_id);

COMMENT ON TABLE public.device_push_tokens IS
  'APNs/FCM device tokens for push. Users manage own rows via RLS; cron reads via service role.';

GRANT SELECT, INSERT, UPDATE, DELETE ON public.device_push_tokens TO authenticated;
GRANT ALL ON public.device_push_tokens TO service_role;
