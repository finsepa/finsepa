/**
 * Supabase Auth often returns terse API errors (e.g. email rate limits on sign-up / resend).
 * Present clearer, actionable copy in the UI.
 */
export function friendlySupabaseAuthErrorMessage(raw: string | null | undefined): string {
  const m = (raw ?? "").trim();
  if (!m) return "Something went wrong. Please try again.";
  const lower = m.toLowerCase();
  if (lower.includes("error sending confirmation email") || lower.includes("sending confirmation email")) {
    return "We could not send the confirmation email from Supabase. If this keeps happening, add LOOPS_API_KEY and LOOPS_TRANSACTIONAL_ID_SIGNUP in production (see .env.example) or fix Supabase → Authentication → SMTP.";
  }
  if (lower.includes("email rate limit") || lower.includes("email rate limit exceeded")) {
    return "Too many sign-up or verification emails were sent from this browser or network recently. Wait up to an hour and try again, or use Continue with Google. If you already started sign-up, check your spam folder for the confirmation link.";
  }
  if (lower.includes("rate limit exceeded") || lower.includes("rate limit")) {
    return "Too many requests right now. Please wait a few minutes and try again.";
  }
  return m;
}
