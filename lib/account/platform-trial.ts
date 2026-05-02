/** Length of the app-level free trial window (not Stripe trialing). */
export const PLATFORM_TRIAL_DAYS = 7;

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
