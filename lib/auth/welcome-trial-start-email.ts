import type { User } from "@supabase/supabase-js";

/** ISO timestamp after the Welcome Trial Start Loops email is sent. */
export const WELCOME_TRIAL_START_SENT_META = "welcome_trial_start_sent_at";

/** @deprecated Legacy key — still read so older accounts are not re-emailed. */
export const GOOGLE_WELCOME_EMAIL_SENT_META = "google_welcome_email_sent_at";

export function hasGoogleIdentity(user: User): boolean {
  if ((user.identities ?? []).some((i) => i.provider === "google")) return true;

  const am = user.app_metadata ?? {};
  if (am.provider === "google") return true;
  const providers = am.providers;
  if (Array.isArray(providers) && providers.includes("google")) return true;

  return false;
}

export function welcomeTrialStartAlreadySent(user: User): boolean {
  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
  for (const key of [WELCOME_TRIAL_START_SENT_META, GOOGLE_WELCOME_EMAIL_SENT_META]) {
    const sent = meta[key];
    if (typeof sent === "string" && sent.trim().length > 0) return true;
  }
  return false;
}

/** @deprecated Use {@link welcomeTrialStartAlreadySent}. */
export const googleWelcomeEmailAlreadySent = welcomeTrialStartAlreadySent;

/** Send Welcome Trial Start once — disabled; platform trial is retired. */
export function shouldSendWelcomeTrialStartEmail(_user: User): boolean {
  return false;
}

/** @deprecated Use {@link shouldSendWelcomeTrialStartEmail}. */
export const shouldSendGoogleWelcomeEmail = shouldSendWelcomeTrialStartEmail;
