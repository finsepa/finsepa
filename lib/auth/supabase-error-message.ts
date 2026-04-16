/**
 * Supabase Auth often returns terse API errors (e.g. email rate limits on sign-up / resend).
 * Present clearer, actionable copy in the UI.
 */
export function friendlySupabaseAuthErrorMessage(raw: string | null | undefined): string {
  const m = (raw ?? "").trim();
  if (!m) return "Something went wrong. Please try again.";
  const lower = m.toLowerCase();
  if (lower.includes("email rate limit") || lower.includes("email rate limit exceeded")) {
    return "Too many sign-up or verification emails were sent from this browser or network recently. Wait up to an hour and try again, or use Continue with Google. If you already started sign-up, check your spam folder for the confirmation link.";
  }
  if (lower.includes("rate limit exceeded") || lower.includes("rate limit")) {
    return "Too many requests right now. Please wait a few minutes and try again.";
  }
  return m;
}
