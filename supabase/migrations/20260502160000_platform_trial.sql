-- 7-day platform trial (independent of Stripe "trialing"): countdown + paywall when elapsed.

ALTER TABLE public.billing_subscriptions
  ADD COLUMN IF NOT EXISTS platform_trial_ends_at timestamptz;

-- Active paid Pro: no platform trial countdown.
-- Everyone else: fresh 7-day window from migration time.
UPDATE public.billing_subscriptions
SET
  platform_trial_ends_at = CASE
    WHEN plan_code LIKE 'pro_%' AND status IN ('active', 'trialing') THEN NULL
    ELSE (now() AT TIME ZONE 'utc') + interval '7 days'
  END,
  updated_at = (now() AT TIME ZONE 'utc')
WHERE true;

-- Users without a billing row yet: create trial row.
INSERT INTO public.billing_subscriptions (user_id, platform_trial_ends_at, plan_code, status)
SELECT
  u.id,
  (now() AT TIME ZONE 'utc') + interval '7 days',
  'trial',
  'trial'
FROM auth.users u
WHERE NOT EXISTS (SELECT 1 FROM public.billing_subscriptions b WHERE b.user_id = u.id);

-- New signups: ensure a subscription row with platform trial end.
CREATE OR REPLACE FUNCTION public.ensure_billing_subscription_platform_trial()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.billing_subscriptions (user_id, platform_trial_ends_at, plan_code, status)
  VALUES (NEW.id, (now() AT TIME ZONE 'utc') + interval '7 days', 'trial', 'trial')
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_billing_platform_trial ON auth.users;
CREATE TRIGGER on_auth_user_created_billing_platform_trial
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.ensure_billing_subscription_platform_trial();
