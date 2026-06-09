-- Earnings release detection (cron / service role) + per-user in-app notifications.

CREATE TABLE IF NOT EXISTS public.earnings_release_snapshot (
  ticker text NOT NULL,
  fiscal_period_end date NOT NULL,
  report_date date,
  eps_actual double precision,
  eps_estimate double precision,
  surprise_pct double precision,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (ticker, fiscal_period_end)
);

CREATE INDEX IF NOT EXISTS earnings_release_snapshot_report_date_idx
  ON public.earnings_release_snapshot (report_date DESC);

ALTER TABLE public.earnings_release_snapshot ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.earnings_release_snapshot IS
  'Last known EODHD calendar actuals per ticker+fiscal period. Written by earnings-notifications cron (service role).';

CREATE TABLE IF NOT EXISTS public.user_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'earnings_released',
  ticker text NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  href text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  dedupe_key text NOT NULL,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_notifications_dedupe_unique UNIQUE (user_id, kind, dedupe_key)
);

CREATE INDEX IF NOT EXISTS user_notifications_user_created_idx
  ON public.user_notifications (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS user_notifications_user_unread_idx
  ON public.user_notifications (user_id)
  WHERE read_at IS NULL;

ALTER TABLE public.user_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users select own notifications" ON public.user_notifications;
CREATE POLICY "Users select own notifications"
  ON public.user_notifications FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users update own notifications" ON public.user_notifications;
CREATE POLICY "Users update own notifications"
  ON public.user_notifications FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

COMMENT ON TABLE public.user_notifications IS
  'In-app notification feed. Inserts via service role (cron); users read/update read_at via RLS.';
