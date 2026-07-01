-- Cache SEC Exhibit 99.1 HTML filings when no quarterly PDF exists.

ALTER TABLE public.earnings_document_cache
  ADD COLUMN IF NOT EXISTS quarterly_report_html_url text;

ALTER TABLE public.earnings_document_cache
  DROP CONSTRAINT IF EXISTS earnings_document_cache_has_url;

ALTER TABLE public.earnings_document_cache
  ADD CONSTRAINT earnings_document_cache_has_url CHECK (
    presentation_pdf_url IS NOT NULL
    OR quarterly_report_pdf_url IS NOT NULL
    OR quarterly_report_html_url IS NOT NULL
  );

COMMENT ON COLUMN public.earnings_document_cache.quarterly_report_html_url IS
  'SEC Form 8-K Exhibit 99.1 HTML press release when no quarterly PDF is available.';
