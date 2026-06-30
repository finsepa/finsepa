-- Live US equity 1m closes for the regular session (WebSocket ingest + live-price tail).
-- Service role only — same pattern as market_snapshot.
CREATE TABLE IF NOT EXISTS public.stock_session_minute_bar (
  ticker text NOT NULL,
  session_ymd date NOT NULL,
  bucket_unix bigint NOT NULL,
  close numeric NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (ticker, bucket_unix)
);

CREATE INDEX IF NOT EXISTS stock_session_minute_bar_session_idx
  ON public.stock_session_minute_bar (ticker, session_ymd, bucket_unix);

COMMENT ON TABLE public.stock_session_minute_bar IS
  'One close per 9:30-anchored minute bucket during the US regular session. Written by WS ingestor and live-price polls; read by 1D chart API.';

-- Tickers recently viewed on a 1D chart — WS worker subscribes to this set.
CREATE TABLE IF NOT EXISTS public.stock_session_minute_bar_watch (
  ticker text PRIMARY KEY,
  last_requested_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS stock_session_minute_bar_watch_requested_idx
  ON public.stock_session_minute_bar_watch (last_requested_at DESC);

COMMENT ON TABLE public.stock_session_minute_bar_watch IS
  'Recently viewed tickers for the EODHD WebSocket minute-bar ingestor. Updated on 1D chart API reads.';

ALTER TABLE public.stock_session_minute_bar ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_session_minute_bar_watch ENABLE ROW LEVEL SECURITY;
