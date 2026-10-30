-- Daily EODHD credit usage, captured by cron just before the provider's midnight-UTC reset.
CREATE TABLE IF NOT EXISTS public.eodhd_usage_daily (
  usage_date date PRIMARY KEY,
  api_requests integer NOT NULL CHECK (api_requests >= 0),
  daily_rate_limit integer,
  extra_limit integer,
  recorded_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.eodhd_usage_daily IS
  'EODHD /api/user apiRequests per UTC day (read at 23:55 UTC). extra_limit = remaining purchased credits.';

ALTER TABLE public.eodhd_usage_daily ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.eodhd_usage_daily FROM anon, authenticated;
