import "server-only";

import { PLATFORM_TRIAL_DAYS } from "@/lib/account/platform-trial";

/** Shared copy for sign-up + Google welcome Loops templates. */
export const LOOPS_TRIAL_PRO_INFO_LINE =
  "Your free trial includes full platform access for 7 days. Upgrade to Finsepa Pro anytime for ongoing research tools, portfolio tracking, and market data.";

export function formatTrialEndsAtForEmail(iso: string | null | undefined): string {
  let value = iso?.trim() || null;
  if (!value) {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() + PLATFORM_TRIAL_DAYS);
    value = d.toISOString();
  }
  try {
    return new Intl.DateTimeFormat("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
      timeZone: "UTC",
    }).format(new Date(value));
  } catch {
    return value.slice(0, 10);
  }
}

/** Default trial fields for new accounts (billing row may not exist until email is confirmed). */
export function buildDefaultTrialEmailVariables(trialDays = PLATFORM_TRIAL_DAYS): {
  trialDays: number;
  trialEndsAt: string;
  proInfoLine: string;
} {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + PLATFORM_TRIAL_DAYS);
  return {
    trialDays,
    trialEndsAt: formatTrialEndsAtForEmail(d.toISOString()),
    proInfoLine: LOOPS_TRIAL_PRO_INFO_LINE,
  };
}
