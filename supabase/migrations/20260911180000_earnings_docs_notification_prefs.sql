-- Slides / Reports activity alerts (Pro; default on). Detected when docs first appear
-- for a recently reported quarter — not historical backfill.

ALTER TABLE public.user_notification_preferences
  ADD COLUMN IF NOT EXISTS slides_enabled boolean NOT NULL DEFAULT true;

ALTER TABLE public.user_notification_preferences
  ADD COLUMN IF NOT EXISTS reports_enabled boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.user_notification_preferences.slides_enabled IS
  'When true (default), users get alerts when earnings presentation slides appear for a followed/held ticker. Effective only for Pro.';

COMMENT ON COLUMN public.user_notification_preferences.reports_enabled IS
  'When true (default), users get alerts when SEC 8-K or 10-Q/10-K appears for a followed/held ticker. Effective only for Pro.';
