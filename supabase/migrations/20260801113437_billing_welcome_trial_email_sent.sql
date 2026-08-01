-- One-time Loops “Welcome Trial Start” send (dedupe callback + onboarding + protected shell).

ALTER TABLE public.billing_subscriptions
  ADD COLUMN IF NOT EXISTS welcome_trial_email_sent_at timestamptz;
