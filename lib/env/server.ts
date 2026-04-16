import "server-only";

import { pickProcessEnv, pickProcessEnvB64 } from "@/lib/env/pick-process-env";

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
  const a = pickProcessEnvB64("U1VQQUJBU0VfU0VSVklDRV9ST0xFX0tFWQ==");
  if (a) return a;
  return pickProcessEnvB64("U1VQQUJBU0VfU0VSVklDRV9LRVk=");
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

export { getLoopsApiKey } from "./loops";

/** Default Finsepa sign-up confirmation transactional in Loops (override with `LOOPS_TRANSACTIONAL_ID_SIGNUP`). */
const LOOPS_TRANSACTIONAL_ID_SIGNUP_DEFAULT = "cm54x9u6103qnqa68w7cg1ls7";

/**
 * Loops transactional email ID for sign-up confirmation.
 * Template must include data variables: `firstName`, `confirmationLink` (see .env.example).
 */
export function getLoopsTransactionalSignupId(): string {
  const v = pickProcessEnv("LOOPS" + "_" + "TRANSACTIONAL" + "_" + "ID" + "_" + "SIGNUP");
  return v || LOOPS_TRANSACTIONAL_ID_SIGNUP_DEFAULT;
}

/** Default Loops transactional for “Reset your password” (override with `LOOPS_TRANSACTIONAL_ID_PASSWORD_RESET`). */
const LOOPS_TRANSACTIONAL_ID_PASSWORD_RESET_DEFAULT = "cmo1t3r8003870izrgv2vae6a";

/**
 * Loops transactional ID for password-reset email (`firstName`, `confirmationLink` in template).
 */
export function getLoopsTransactionalPasswordResetId(): string {
  const v = pickProcessEnv(
    "LOOPS" + "_" + "TRANSACTIONAL" + "_" + "ID" + "_" + "PASSWORD" + "_" + "RESET",
  );
  return v || LOOPS_TRANSACTIONAL_ID_PASSWORD_RESET_DEFAULT;
}
