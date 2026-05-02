-- One Loops “Pro renewed” send per paid renewal invoice (dedupe webhooks vs billing sync).

ALTER TABLE public.billing_invoices
  ADD COLUMN IF NOT EXISTS loops_renewal_email_sent_at timestamptz;
