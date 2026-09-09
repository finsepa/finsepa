-- HIGH-confidence SEC Reports (8-K + 10-Q/10-K). Additive — do not drop legacy IR cache columns.

ALTER TABLE public.earnings_document_cache
  ADD COLUMN IF NOT EXISTS eight_k_url text;

ALTER TABLE public.earnings_document_cache
  ADD COLUMN IF NOT EXISTS form10_url text;

ALTER TABLE public.earnings_document_cache
  ADD COLUMN IF NOT EXISTS form10_kind text;

ALTER TABLE public.earnings_document_cache
  DROP CONSTRAINT IF EXISTS earnings_document_cache_form10_kind_check;

ALTER TABLE public.earnings_document_cache
  ADD CONSTRAINT earnings_document_cache_form10_kind_check
  CHECK (form10_kind IS NULL OR form10_kind IN ('10-Q', '10-K'));

ALTER TABLE public.earnings_document_cache
  DROP CONSTRAINT IF EXISTS earnings_document_cache_has_url;

ALTER TABLE public.earnings_document_cache
  ADD CONSTRAINT earnings_document_cache_has_url CHECK (
    presentation_pdf_url IS NOT NULL
    OR quarterly_report_pdf_url IS NOT NULL
    OR quarterly_report_html_url IS NOT NULL
    OR eight_k_url IS NOT NULL
    OR form10_url IS NOT NULL
  );

COMMENT ON COLUMN public.earnings_document_cache.eight_k_url IS
  'HIGH-confidence earnings Item 2.02 Form 8-K primary document (SEC Archives).';

COMMENT ON COLUMN public.earnings_document_cache.form10_url IS
  'HIGH-confidence Form 10-Q or 10-K primary document (SEC Archives).';

COMMENT ON COLUMN public.earnings_document_cache.form10_kind IS
  '10-Q or 10-K according to the matched SEC form, not the Finsepa quarter label.';
