-- Live 24/7 crypto 1m closes for the rolling-24h 1D chart (WebSocket ingest). BTC only initially.
-- Service role only — same pattern as stock_session_minute_bar, but no session_ymd (crypto trades 24/7).
CREATE TABLE IF NOT EXISTS public.crypto_session_minute_bar (
  ticker text NOT NULL,        -- base symbol, e.g. 'BTC'
  bucket_unix bigint NOT NULL, -- UTC minute bucket (floor to minute)
  close numeric NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (ticker, bucket_unix)
);

CREATE INDEX IF NOT EXISTS crypto_session_minute_bar_ticker_bucket_idx
  ON public.crypto_session_minute_bar (ticker, bucket_unix DESC);

COMMENT ON TABLE public.crypto_session_minute_bar IS
  'One close per UTC minute bucket for live crypto 1D charts (24/7, rolling last 24h). Written by the crypto WS ingestor; read by the crypto 1D chart API. BTC only initially.';

ALTER TABLE public.crypto_session_minute_bar ENABLE ROW LEVEL SECURITY;
