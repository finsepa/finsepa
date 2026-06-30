-- Tracks post-close EODHD tick backfill into stock_session_minute_bar (Phase 3).
CREATE TABLE IF NOT EXISTS public.stock_session_minute_bar_backfill (
  ticker text NOT NULL,
  session_ymd date NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  bar_count integer,
  api_calls integer,
  last_error text,
  completed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (ticker, session_ymd),
  CONSTRAINT stock_session_minute_bar_backfill_status_check CHECK (
    status IN ('pending', 'in_progress', 'complete', 'partial', 'unavailable', 'failed')
  )
);

CREATE INDEX IF NOT EXISTS stock_session_minute_bar_backfill_pending_idx
  ON public.stock_session_minute_bar_backfill (status, updated_at)
  WHERE status IN ('pending', 'partial', 'failed');

COMMENT ON TABLE public.stock_session_minute_bar_backfill IS
  'Post-close tick backfill jobs for full 1D minute-bar history. One row per ticker + US session day.';

ALTER TABLE public.stock_session_minute_bar_backfill ENABLE ROW LEVEL SECURITY;
