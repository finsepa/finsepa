/**
 * Supabase Auth often returns terse API errors (e.g. email rate limits on sign-up / resend).
 * Present clearer, actionable copy in the UI.
 */

/**
 * When true, try `/api/auth/signup-with-loops`: admin `generateLink` + Loops avoids Supabase SMTP
 * and the public sign-up email rate limit.
 *
 * Prefer GoTrue `code` / HTTP `status`: `over_email_send_rate_limit` often omits that phrasing in `message`.
 */
export function shouldAttemptLoopsSignupFallback(
  raw: string | null | undefined,
  code?: string | null,
  status?: number | null,
): boolean {
  const c = (code ?? "").toLowerCase();
  if (c === "over_email_send_rate_limit" || c === "over_request_rate_limit") return true;
  if (status === 429) return true;

  const m = (raw ?? "").toLowerCase();
  if (/confirmation email|error sending confirmation email|smtp|mailer/i.test(m)) return true;
  if (m.includes("over_email_send_rate_limit")) return true;
  if (m.includes("email rate limit") || m.includes("email_rate_limit")) return true;
  if (
    m.includes("rate limit") &&
    (m.includes("email") || m.includes("signup") || m.includes("verification") || m.includes("confirm"))
  ) {
    return true;
  }
  return false;
}

export function friendlySupabaseAuthErrorMessage(raw: string | null | undefined): string {
  const m = (raw ?? "").trim();
  if (!m) return "Something went wrong. Please try again.";
  const lower = m.toLowerCase();
  if (lower.includes("error sending confirmation email") || lower.includes("sending confirmation email")) {
    return "We could not send the confirmation email from Supabase. If this keeps happening, add LOOPS_API_KEY and LOOPS_TRANSACTIONAL_ID_SIGNUP in production (see .env.example) or fix Supabase → Authentication → SMTP.";
  }
  if (
    lower.includes("email rate limit") ||
    lower.includes("email rate limit exceeded") ||
    lower.includes("over_email_send_rate_limit")
  ) {
    return "Too many sign-up or verification emails were sent from this browser or network recently. Wait up to an hour and try again, or use Continue with Google. If you already started sign-up, check your spam folder for the confirmation link.";
  }
  if (lower.includes("rate limit exceeded") || lower.includes("rate limit")) {
    return "Too many requests right now. Please wait a few minutes and try again.";
  }
  return m;
}

/**
 * Safari/WebKit often throw `Error` with message `"Load failed"` when `fetch` cannot complete
 * (embedded preview, mixed content, offline, blocked request). Chrome uses `"Failed to fetch"`.
 */
export function friendlyNetworkErrorMessage(err: unknown): string {
  if (!(err instanceof Error)) return "Something went wrong. Please try again.";
  const m = err.message.trim();
  const lower = m.toLowerCase();
  if (
    m === "Load failed" ||
    lower === "failed to fetch" ||
    lower.includes("networkerror when attempting to fetch") ||
    lower.includes("network request failed")
  ) {
    return "The sign-up request never reached this app’s server (browser blocked the request or the dev server is not reachable). Open the app in a full browser tab—e.g. http://localhost:3000—not Cursor’s Simple Browser or an embedded preview. Confirm `npm run dev` is running, then try again.";
  }
  return m;
}
