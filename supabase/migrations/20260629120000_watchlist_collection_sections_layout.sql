-- Per-watchlist section layout (custom groups + ticker assignments).

ALTER TABLE public.watchlist_collections
  ADD COLUMN IF NOT EXISTS sections_layout jsonb NOT NULL DEFAULT '{"sections":[],"tickerSections":{}}'::jsonb;

COMMENT ON COLUMN public.watchlist_collections.sections_layout IS
  'Client watchlist sections: { "sections": [{ "id", "name" }], "tickerSections": { "TICKER": "sectionId" } }';
