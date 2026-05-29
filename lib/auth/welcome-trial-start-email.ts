import type { User } from "@supabase/supabase-js";

/** ISO timestamp after the Welcome Trial Start Loops email is sent. */
export const WELCOME_TRIAL_START_SENT_META = "welcome_trial_start_sent_at";

/** @deprecated Legacy key — still read so older accounts are not re-emailed. */
export const GOOGLE_WELCOME_EMAIL_SENT_META = "google_welcome_email_sent_at";

const NEW_ACCOUNT_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

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

function isGoogleFirstSignup(user: User): boolean {
  const identities = user.identities ?? [];
  const emailIdentity = identities.find((i) => i.provider === "email");
  const googleIdentity = identities.find((i) => i.provider === "google");

  if (!emailIdentity) return true;
  if (!googleIdentity) return hasGoogleIdentity(user);

  const emailAt = emailIdentity.created_at ? new Date(emailIdentity.created_at).getTime() : NaN;
  const googleAt = googleIdentity.created_at
    ? new Date(googleIdentity.created_at).getTime()
    : new Date(user.created_at).getTime();
  if (Number.isNaN(emailAt)) return true;

  return googleAt <= emailAt;
}

function isEmailPasswordSignup(user: User): boolean {
  if (hasGoogleIdentity(user)) return false;

  const identities = user.identities ?? [];
  if (identities.some((i) => i.provider === "email")) return true;

  const provider = (user.app_metadata ?? {}).provider;
  return provider === "email";
}

function isRecentAccount(user: User): boolean {
  const createdAt = new Date(user.created_at).getTime();
  return !Number.isNaN(createdAt) && Date.now() - createdAt < NEW_ACCOUNT_WINDOW_MS;
}

/**
 * Send Welcome Trial Start once:
 * - Google sign-up (no confirm email)
 * - Email/password sign-up after email confirmation (recent account)
 */
export function shouldSendWelcomeTrialStartEmail(user: User): boolean {
  if (!user.email?.trim()) return false;
  if (welcomeTrialStartAlreadySent(user)) return false;

  if (hasGoogleIdentity(user)) {
    return isGoogleFirstSignup(user);
  }

  if (!isEmailPasswordSignup(user)) return false;
  if (!user.email_confirmed_at) return false;

  return isRecentAccount(user);
}

/** @deprecated Use {@link shouldSendWelcomeTrialStartEmail}. */
export const shouldSendGoogleWelcomeEmail = shouldSendWelcomeTrialStartEmail;
