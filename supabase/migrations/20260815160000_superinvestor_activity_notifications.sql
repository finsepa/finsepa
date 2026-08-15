-- Superinvestor 13F activity alerts (Pro/Trial; default on).

ALTER TABLE public.user_notification_preferences
  ADD COLUMN IF NOT EXISTS superinvestor_activity_enabled boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.user_notification_preferences.superinvestor_activity_enabled IS
  'When true (default), followers receive alerts when a followed manager files a new 13F. Effective only for Pro/Trial.';
