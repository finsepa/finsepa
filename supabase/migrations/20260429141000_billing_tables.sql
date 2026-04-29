-- Persistent billing state (migration-safe across Stripe account changes).

CREATE TABLE IF NOT EXISTS public.billing_customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  stripe_account_key text NOT NULL,
  stripe_customer_id text NOT NULL,
  email text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT billing_customers_user_account_unique UNIQUE (user_id, stripe_account_key),
  CONSTRAINT billing_customers_account_customer_unique UNIQUE (stripe_account_key, stripe_customer_id)
);

CREATE TABLE IF NOT EXISTS public.billing_subscriptions (
  user_id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  stripe_account_key text NOT NULL DEFAULT 'primary',
  stripe_customer_id text,
  stripe_subscription_id text,
  stripe_price_id text,
  recurring_amount_usd numeric(12, 2) NOT NULL DEFAULT 0,
  plan_code text NOT NULL DEFAULT 'trial',
  status text NOT NULL DEFAULT 'trial',
  current_period_end timestamptz,
  cancel_at_period_end boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT billing_subscriptions_account_subscription_unique UNIQUE (stripe_account_key, stripe_subscription_id)
);

CREATE TABLE IF NOT EXISTS public.billing_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  stripe_account_key text NOT NULL,
  stripe_invoice_id text NOT NULL,
  stripe_subscription_id text,
  amount_usd numeric(12, 2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'usd',
  paid_at timestamptz NOT NULL,
  description text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT billing_invoices_account_invoice_unique UNIQUE (stripe_account_key, stripe_invoice_id)
);

CREATE TABLE IF NOT EXISTS public.billing_webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_account_key text NOT NULL,
  stripe_event_id text NOT NULL,
  event_type text NOT NULL,
  payload jsonb NOT NULL,
  processed_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT billing_webhook_events_account_event_unique UNIQUE (stripe_account_key, stripe_event_id)
);

CREATE INDEX IF NOT EXISTS billing_customers_user_id_idx ON public.billing_customers (user_id);
CREATE INDEX IF NOT EXISTS billing_subscriptions_status_idx ON public.billing_subscriptions (status);
CREATE INDEX IF NOT EXISTS billing_invoices_user_paid_at_idx ON public.billing_invoices (user_id, paid_at DESC);

ALTER TABLE public.billing_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_webhook_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users select own billing customers" ON public.billing_customers;
CREATE POLICY "Users select own billing customers"
  ON public.billing_customers FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users select own billing subscriptions" ON public.billing_subscriptions;
CREATE POLICY "Users select own billing subscriptions"
  ON public.billing_subscriptions FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users select own billing invoices" ON public.billing_invoices;
CREATE POLICY "Users select own billing invoices"
  ON public.billing_invoices FOR SELECT
  USING (auth.uid() = user_id);
