import "server-only";

/**
 * Server-only provider keys. Import from Route Handlers / Server Actions only.
 * Client code must never read EODHD_API_KEY or FINNHUB_API_KEY.
 */
export function getEodhdApiKey(): string | undefined {
  const v = process.env.EODHD_API_KEY?.trim();
  return v || undefined;
}

export function getFinnhubApiKey(): string | undefined {
  const v = process.env.FINNHUB_API_KEY?.trim();
  return v || undefined;
}

/** Supabase service role key (server-only). Used for privileged reads (e.g. global watchlist counts). */
export function getSupabaseServiceRoleKey(): string | undefined {
  const a = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (a) return a;
  const b = process.env.SUPABASE_SERVICE_KEY?.trim();
  return b || undefined;
}

/** OpenAI API key (server-only). Used for portfolio import column mapping. */
export function getOpenAiApiKey(): string | undefined {
  const v = process.env.OPENAI_API_KEY?.trim();
  return v || undefined;
}

/**
 * SEC EDGAR requires a descriptive User-Agent (app name + contact URL or email).
 * @see https://www.sec.gov/os/accessing-edgar-data
 */
export function getSecEdgarUserAgent(): string {
  const v = process.env.SEC_EDGAR_USER_AGENT?.trim();
  if (v) return v;
  return "Finsepa/1.0 (set SEC_EDGAR_USER_AGENT with your contact email or URL per sec.gov policy)";
}

/** Loops API key (https://app.loops.so → API). Used to send sign-up confirmation when Supabase SMTP fails. */
export function getLoopsApiKey(): string | undefined {
  const v = process.env.LOOPS_API_KEY?.trim();
  return v || undefined;
}

/** Default Finsepa sign-up confirmation transactional in Loops (override with `LOOPS_TRANSACTIONAL_ID_SIGNUP`). */
const LOOPS_TRANSACTIONAL_ID_SIGNUP_DEFAULT = "cm54x9u6103qnqa68w7cg1ls7";

/**
 * Loops transactional email ID for sign-up confirmation.
 * Template must include data variables: `firstName`, `confirmationLink` (see .env.example).
 */
export function getLoopsTransactionalSignupId(): string {
  const v = process.env.LOOPS_TRANSACTIONAL_ID_SIGNUP?.trim();
  return v || LOOPS_TRANSACTIONAL_ID_SIGNUP_DEFAULT;
}
