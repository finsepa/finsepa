import type { User } from "@supabase/supabase-js";

/** ISO timestamp in `user_metadata` after the Google welcome Loops email is sent. */
export const GOOGLE_WELCOME_EMAIL_SENT_META = "google_welcome_email_sent_at";

const GOOGLE_SIGNUP_WINDOW_MS = 24 * 60 * 60 * 1000;

export function hasGoogleIdentity(user: User): boolean {
  return (user.identities ?? []).some((i) => i.provider === "google");
}

export function googleWelcomeEmailAlreadySent(user: User): boolean {
  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
  const sent = meta[GOOGLE_WELCOME_EMAIL_SENT_META];
  return typeof sent === "string" && sent.trim().length > 0;
}

/**
 * True for new accounts that signed up via Google (not email/password first, then link Google later).
 */
export function shouldSendGoogleWelcomeEmail(user: User): boolean {
  if (!user.email?.trim()) return false;
  if (!hasGoogleIdentity(user)) return false;
  if (googleWelcomeEmailAlreadySent(user)) return false;

  const createdAt = new Date(user.created_at).getTime();
  if (Number.isNaN(createdAt) || Date.now() - createdAt > GOOGLE_SIGNUP_WINDOW_MS) {
    return false;
  }

  const identities = user.identities ?? [];
  const emailIdentity = identities.find((i) => i.provider === "email");
  const googleIdentity = identities.find((i) => i.provider === "google");
  if (!googleIdentity) return false;

  if (!emailIdentity) return true;

  const emailAt = emailIdentity.created_at ? new Date(emailIdentity.created_at).getTime() : NaN;
  const googleAt = googleIdentity.created_at ? new Date(googleIdentity.created_at).getTime() : createdAt;
  if (Number.isNaN(emailAt)) return true;

  // Email/password signup first — skip OAuth welcome (they get confirmation email instead).
  return googleAt <= emailAt;
}
