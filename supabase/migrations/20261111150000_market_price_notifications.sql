-- Market notifications (free; default on): new 52-week / all-time highs and lows, and ±5% / ±10% daily moves
-- for watchlist + held stocks. Detected every 15 minutes from the `us_quotes_bulk` snapshot.

ALTER TABLE public.user_notification_preferences
  ADD COLUMN IF NOT EXISTS market_high_low_enabled boolean NOT NULL DEFAULT true;

ALTER TABLE public.user_notification_preferences
  ADD COLUMN IF NOT EXISTS price_alerts_enabled boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.user_notification_preferences.market_high_low_enabled IS
  'When true (default), users get alerts when a followed/held stock hits a new 52-week or all-time high or low.';

COMMENT ON COLUMN public.user_notification_preferences.price_alerts_enabled IS
  'When true (default), users get alerts when a followed/held stock moves ±5% or ±10% in a day.';

-- One row per market event per ticker (shared by all followers), so each move / new high fires once
-- even as the price keeps moving within the same day or week. Service role only.
CREATE TABLE IF NOT EXISTS public.market_alert_events (
  ticker text NOT NULL,
  event_key text NOT NULL,
  kind text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (ticker, event_key)
);

CREATE INDEX IF NOT EXISTS market_alert_events_created_at_idx
  ON public.market_alert_events (created_at);

ALTER TABLE public.market_alert_events ENABLE ROW LEVEL SECURITY;
