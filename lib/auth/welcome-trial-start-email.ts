import type { User } from "@supabase/supabase-js";

/** ISO timestamp after the signup welcome Loops email is sent. */
export const WELCOME_TRIAL_START_SENT_META = "welcome_trial_start_sent_at";

/** @deprecated Legacy key — still read so older accounts are not re-emailed. */
export const GOOGLE_WELCOME_EMAIL_SENT_META = "google_welcome_email_sent_at";

/** Avoid emailing long-lived accounts that never received the retired trial welcome. */
const NEW_ACCOUNT_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

function hasProviderIdentity(user: User, provider: string): boolean {
  if ((user.identities ?? []).some((i) => i.provider === provider)) return true;

  const am = user.app_metadata ?? {};
  if (am.provider === provider) return true;
  const providers = am.providers;
  if (Array.isArray(providers) && providers.includes(provider)) return true;

  return false;
}

export function hasGoogleIdentity(user: User): boolean {
  return hasProviderIdentity(user, "google");
}

export function hasAppleIdentity(user: User): boolean {
  return hasProviderIdentity(user, "apple");
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

function isOAuthFirstSignup(user: User, provider: "google" | "apple"): boolean {
  const identities = user.identities ?? [];
  const emailIdentity = identities.find((i) => i.provider === "email");
  const oauthIdentity = identities.find((i) => i.provider === provider);

  if (!emailIdentity) return true;
  if (!oauthIdentity) return hasProviderIdentity(user, provider);

  const emailAt = emailIdentity.created_at ? new Date(emailIdentity.created_at).getTime() : NaN;
  const oauthAt = oauthIdentity.created_at
    ? new Date(oauthIdentity.created_at).getTime()
    : new Date(user.created_at).getTime();
  if (Number.isNaN(emailAt)) return true;

  return oauthAt <= emailAt;
}

function isEmailSignup(user: User): boolean {
  if (hasGoogleIdentity(user) || hasAppleIdentity(user)) return false;

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
 * Send the Loops signup welcome once for a new account:
 * - Google / Apple first sign-up
 * - Email OTP or password after the address is confirmed
 */
export function shouldSendWelcomeTrialStartEmail(user: User): boolean {
  if (!user.email?.trim()) return false;
  if (welcomeTrialStartAlreadySent(user)) return false;
  if (!isRecentAccount(user)) return false;

  if (hasGoogleIdentity(user)) return isOAuthFirstSignup(user, "google");
  if (hasAppleIdentity(user)) return isOAuthFirstSignup(user, "apple");

  if (!isEmailSignup(user)) return false;
  if (!user.email_confirmed_at) return false;

  return true;
}

/** @deprecated Use {@link shouldSendWelcomeTrialStartEmail}. */
export const shouldSendGoogleWelcomeEmail = shouldSendWelcomeTrialStartEmail;
