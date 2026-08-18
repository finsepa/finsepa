-- New users start on Free (restricted). Platform 7-day trial is retired.
-- Existing trial rows are migrated to Free; paid Pro is unchanged.

ALTER TABLE public.billing_subscriptions
  ALTER COLUMN plan_code SET DEFAULT 'free',
  ALTER COLUMN status SET DEFAULT 'free';

CREATE OR REPLACE FUNCTION public.ensure_billing_subscription_platform_trial()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.email_confirmed_at IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.billing_subscriptions (user_id, platform_trial_ends_at, plan_code, status)
  VALUES (NEW.id, (now() AT TIME ZONE 'utc') - interval '1 day', 'free', 'free')
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

-- Expire any remaining platform-trial window on non-Pro rows, then label them Free.
UPDATE public.billing_subscriptions
SET
  platform_trial_ends_at = LEAST(
    COALESCE(platform_trial_ends_at, (now() AT TIME ZONE 'utc') - interval '1 day'),
    (now() AT TIME ZONE 'utc') - interval '1 day'
  ),
  plan_code = 'free',
  status = 'free',
  updated_at = (now() AT TIME ZONE 'utc')
WHERE plan_code = 'trial'
   OR (status = 'trial' AND plan_code NOT LIKE 'pro_%' AND plan_code IS DISTINCT FROM 'pro');
