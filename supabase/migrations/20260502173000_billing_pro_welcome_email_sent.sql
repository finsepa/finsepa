-- One-time Loops “Pro activated” send (dedupe checkout.session.completed vs invoice.paid).

ALTER TABLE public.billing_subscriptions
  ADD COLUMN IF NOT EXISTS pro_welcome_email_sent_at timestamptz;
