-- Durable cache for resolved earnings Slides/Filings PDF URLs (server / service role).

CREATE TABLE IF NOT EXISTS public.earnings_document_cache (
  ticker text NOT NULL,
  fiscal_period_end date NOT NULL,
  presentation_pdf_url text,
  quarterly_report_pdf_url text,
  resolution_source text NOT NULL DEFAULT 'unknown',
  report_date date,
  verified_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (ticker, fiscal_period_end),
  CONSTRAINT earnings_document_cache_ticker_upper CHECK (ticker = upper(ticker)),
  CONSTRAINT earnings_document_cache_has_url CHECK (
    presentation_pdf_url IS NOT NULL OR quarterly_report_pdf_url IS NOT NULL
  )
);

CREATE INDEX IF NOT EXISTS earnings_document_cache_ticker_idx
  ON public.earnings_document_cache (ticker);

ALTER TABLE public.earnings_document_cache ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.earnings_document_cache IS
  'Verified direct PDF URLs for earnings Slides/Filings per ticker+fiscal period. Written by stock earnings tab enrichment (service role).';
