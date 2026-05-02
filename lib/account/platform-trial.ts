import { hasActivePaidProSubscription } from "@/lib/account/billing-guard";

/** Length of the app-level free trial window (not Stripe trialing). */
export const PLATFORM_TRIAL_DAYS = 7;

export type PlatformTrialSubscriptionRow = {
  platform_trial_ends_at?: string | null;
  plan_code?: string | null;
  status?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

/**
 * Resolves the trial end timestamp used for countdown + paywall.
 * Prefer `platform_trial_ends_at`; if missing (e.g. manual Stripe cancel without webhook),
 * infer `updated_at` or `created_at` + {@link PLATFORM_TRIAL_DAYS} for explicit trial rows only.
 */
export function effectivePlatformTrialEndsAtIso(row: PlatformTrialSubscriptionRow | null | undefined): string | null {
  if (!row) return null;

  const explicit =
    typeof row.platform_trial_ends_at === "string" ? row.platform_trial_ends_at.trim() : "";
  if (explicit) return row.platform_trial_ends_at as string;

  if (hasActivePaidProSubscription(row)) return null;

  const plan = row.plan_code ?? "";
  const stalePro = plan.startsWith("pro_") && !hasActivePaidProSubscription(row);
  if (stalePro) return null;

  const trialLike =
    plan === "trial" || row.status === "trial" || plan === "pro";
  if (!trialLike) return null;

  const anchorIsoRaw = row.updated_at ?? row.created_at;
  const anchorIso = typeof anchorIsoRaw === "string" ? anchorIsoRaw.trim() : "";
  if (!anchorIso) return null;

  const anchor = new Date(anchorIso);
  if (!Number.isFinite(anchor.getTime())) return null;

  return new Date(anchor.getTime() + PLATFORM_TRIAL_DAYS * 86_400_000).toISOString();
}

export function platformTrialDaysRemaining(platformTrialEndsAtIso: string | null | undefined): number | null {
  if (!platformTrialEndsAtIso) return null;
  const end = new Date(platformTrialEndsAtIso);
  if (!Number.isFinite(end.getTime())) return null;
  const ms = end.getTime() - Date.now();
  if (ms <= 0) return 0;
  return Math.max(1, Math.ceil(ms / 86_400_000));
}

export function isPlatformTrialPast(platformTrialEndsAtIso: string | null | undefined): boolean {
  if (!platformTrialEndsAtIso) return false;
  const end = new Date(platformTrialEndsAtIso);
  if (!Number.isFinite(end.getTime())) return false;
  return Date.now() >= end.getTime();
}
