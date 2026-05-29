import type { User } from "@supabase/supabase-js";

/** ISO timestamp in `user_metadata` after the Google welcome Loops email is sent. */
export const GOOGLE_WELCOME_EMAIL_SENT_META = "google_welcome_email_sent_at";

export function hasGoogleIdentity(user: User): boolean {
  if ((user.identities ?? []).some((i) => i.provider === "google")) return true;

  const am = user.app_metadata ?? {};
  if (am.provider === "google") return true;
  const providers = am.providers;
  if (Array.isArray(providers) && providers.includes("google")) return true;

  return false;
}

export function googleWelcomeEmailAlreadySent(user: User): boolean {
  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
  const sent = meta[GOOGLE_WELCOME_EMAIL_SENT_META];
  return typeof sent === "string" && sent.trim().length > 0;
}

/**
 * True for accounts that signed up via Google (not email/password first, then link Google later).
 * Retries on later Google logins until the welcome email is sent successfully.
 */
export function shouldSendGoogleWelcomeEmail(user: User): boolean {
  if (!user.email?.trim()) return false;
  if (!hasGoogleIdentity(user)) return false;
  if (googleWelcomeEmailAlreadySent(user)) return false;

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
