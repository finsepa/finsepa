-- Apple In-App Purchase fields on the single billing_subscriptions row per user.

ALTER TABLE public.billing_subscriptions
  ADD COLUMN IF NOT EXISTS billing_provider text,
  ADD COLUMN IF NOT EXISTS apple_original_transaction_id text,
  ADD COLUMN IF NOT EXISTS apple_product_id text,
  ADD COLUMN IF NOT EXISTS apple_environment text;

COMMENT ON COLUMN public.billing_subscriptions.billing_provider IS
  'stripe | apple — who currently bills Pro. Null for trial/free with no paid provider.';

CREATE UNIQUE INDEX IF NOT EXISTS billing_subscriptions_apple_original_tx_uidx
  ON public.billing_subscriptions (apple_original_transaction_id)
  WHERE apple_original_transaction_id IS NOT NULL;
