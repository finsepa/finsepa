-- Learned slide-deck URL patterns from successful earnings document resolution.

CREATE TABLE IF NOT EXISTS public.earnings_slide_host_patterns (
  host text NOT NULL,
  path_pattern text NOT NULL,
  deck_format text NOT NULL,
  sample_url text,
  hit_count integer NOT NULL DEFAULT 1,
  last_ticker text,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (host, path_pattern, deck_format),
  CONSTRAINT earnings_slide_host_patterns_ticker_upper CHECK (
    last_ticker IS NULL OR last_ticker = upper(last_ticker)
  )
);

CREATE INDEX IF NOT EXISTS earnings_slide_host_patterns_host_idx
  ON public.earnings_slide_host_patterns (host);

ALTER TABLE public.earnings_slide_host_patterns ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.earnings_slide_host_patterns IS
  'Aggregated CDN/IR path patterns for earnings slide decks discovered during document enrichment.';
