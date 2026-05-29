-- Only create billing trial rows after email confirmation (or OAuth users confirmed on insert).
-- Stops spam sign-up floods from writing billing_subscriptions on every auth.users INSERT.

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
  VALUES (NEW.id, (now() AT TIME ZONE 'utc') + interval '7 days', 'trial', 'trial')
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_billing_platform_trial ON auth.users;

CREATE TRIGGER on_auth_user_created_billing_platform_trial
  AFTER INSERT OR UPDATE OF email_confirmed_at ON auth.users
  FOR EACH ROW
  WHEN (NEW.email_confirmed_at IS NOT NULL)
  EXECUTE FUNCTION public.ensure_billing_subscription_platform_trial();
