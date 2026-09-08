-- Phase 1 IR document vault: first-party Slides + Filings only (no SEC).
-- Merge-only locks: once a URL is set it is never overwritten.

CREATE TABLE IF NOT EXISTS public.earnings_ir_vault (
  ticker text NOT NULL,
  fiscal_period_end date NOT NULL,
  fiscal_period_label text,
  report_date date,
  slides_url text,
  filings_url text,
  slides_locked boolean NOT NULL DEFAULT false,
  filings_locked boolean NOT NULL DEFAULT false,
  ir_website text,
  resolution_note text,
  verified_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (ticker, fiscal_period_end),
  CONSTRAINT earnings_ir_vault_ticker_upper CHECK (ticker = upper(ticker))
);

CREATE INDEX IF NOT EXISTS earnings_ir_vault_ticker_idx
  ON public.earnings_ir_vault (ticker);

CREATE INDEX IF NOT EXISTS earnings_ir_vault_report_date_idx
  ON public.earnings_ir_vault (report_date);

ALTER TABLE public.earnings_ir_vault ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.earnings_ir_vault IS
  'Phase-1 IR vault: locked first-party slides/filings per ticker+fiscal period (Q1 2022+). Written by vault backfill/cron; never overwritten once locked.';
