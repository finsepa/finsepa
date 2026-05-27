-- Shared market quote snapshots (cron ingest → user reads). Service role only.
CREATE TABLE IF NOT EXISTS public.market_snapshot (
  key text PRIMARY KEY,
  segment text NOT NULL,
  data jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS market_snapshot_segment_idx ON public.market_snapshot (segment);

ALTER TABLE public.market_snapshot ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.market_snapshot IS
  'EODHD-derived list quotes keyed by US session segment (live 15m slot or frozen close day). Written by cron; read by app via service role.';
