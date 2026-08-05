-- One-time Loops “Pro ended — switched to Free” send (subscription deleted / Free after Pro).

ALTER TABLE public.billing_subscriptions
  ADD COLUMN IF NOT EXISTS loops_pro_ended_free_email_sent_at timestamptz;
