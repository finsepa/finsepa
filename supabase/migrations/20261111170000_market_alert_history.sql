-- Per-asset, per-session high/low levels for Market notifications. Computed once from the full daily
-- history, then reused by every 15-minute run that day (the platform data cache does not hold these
-- reliably between cron invocations).
CREATE TABLE IF NOT EXISTS public.market_alert_history (
  asset_key text NOT NULL,
  day_ymd text NOT NULL,
  extremes jsonb,
  last_close double precision,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (asset_key, day_ymd)
);

CREATE INDEX IF NOT EXISTS market_alert_history_day_idx ON public.market_alert_history (day_ymd);

ALTER TABLE public.market_alert_history ENABLE ROW LEVEL SECURITY;
