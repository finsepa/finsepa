-- One-time Loops “Pro subscription canceled” send per cancel schedule
-- (cleared when cancel_at_period_end returns to false so a later cancel can notify again).

ALTER TABLE public.billing_subscriptions
  ADD COLUMN IF NOT EXISTS loops_pro_cancel_email_sent_at timestamptz;
