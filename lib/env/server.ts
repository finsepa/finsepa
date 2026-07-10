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
  // SEC EDGAR blocks automated requests without a descriptive User-Agent that includes contact info.
  // Provide a compliant default for local/dev to avoid silent data gaps in SEC-backed pages.
  return "Finsepa/1.0 (support@finsepa.com)";
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

/** Default “Finsepa Pro is now active” transactional in Loops (override with `LOOPS_TRANSACTIONAL_ID_PRO_ACTIVATED`). */
const LOOPS_TRANSACTIONAL_ID_PRO_ACTIVATED_DEFAULT = "cmoo8ezzr0qrb0i2mhrw29zlx";

/**
 * Loops transactional ID for first paid Pro subscription invoice (`invoice.paid`, `billing_reason` = subscription_create).
 */
export function getLoopsTransactionalProActivatedId(): string {
  const v = pickProcessEnv(
    "LOOPS" + "_" + "TRANSACTIONAL" + "_" + "ID" + "_" + "PRO" + "_" + "ACTIVATED",
  );
  return v || LOOPS_TRANSACTIONAL_ID_PRO_ACTIVATED_DEFAULT;
}

/** Default “Finsepa Pro has been renewed” transactional in Loops (override with `LOOPS_TRANSACTIONAL_ID_PRO_RENEWED`). */
const LOOPS_TRANSACTIONAL_ID_PRO_RENEWED_DEFAULT = "cmoo8r6n40k7y0izkctvh3nvq";

/**
 * Loops transactional ID for recurring Pro renewal (`invoice.paid`, `billing_reason` = subscription_cycle).
 */
export function getLoopsTransactionalProRenewedId(): string {
  const v = pickProcessEnv(
    "LOOPS" + "_" + "TRANSACTIONAL" + "_" + "ID" + "_" + "PRO" + "_" + "RENEWED",
  );
  return v || LOOPS_TRANSACTIONAL_ID_PRO_RENEWED_DEFAULT;
}

/** Default “Welcome Trial Start” transactional in Loops. */
const LOOPS_TRANSACTIONAL_ID_WELCOME_TRIAL_START_DEFAULT = "cmpqlacpq1dux0j155z7t77cv";

/**
 * Loops “Welcome Trial Start” (Google sign-up or after email confirm).
 * Template data variables: firstName, platformLink, trialDays, trialEndsAt, proInfoLine.
 * Button link in Loops editor: `{data.platformLink}` (same as `{data.confirmationLink}` on other templates).
 */
export function getLoopsTransactionalWelcomeTrialStartId(): string {
  const welcome = pickProcessEnv(
    "LOOPS" + "_" + "TRANSACTIONAL" + "_" + "ID" + "_" + "WELCOME" + "_" + "TRIAL" + "_" + "START",
  );
  if (welcome?.trim()) return welcome.trim();

  const legacyGoogle = pickProcessEnv(
    "LOOPS" + "_" + "TRANSACTIONAL" + "_" + "ID" + "_" + "GOOGLE" + "_" + "WELCOME",
  );
  return legacyGoogle?.trim() || LOOPS_TRANSACTIONAL_ID_WELCOME_TRIAL_START_DEFAULT;
}

/** @deprecated Use {@link getLoopsTransactionalWelcomeTrialStartId}. */
export function getLoopsTransactionalGoogleWelcomeId(): string {
  return getLoopsTransactionalWelcomeTrialStartId();
}

/**
 * Loops transactional ID for in-app Help feedback (delivered to hi@finsepa.com).
 * Template: “New Feedback from Finsepa”. Variables: userEmail, userName, messageText, pageUrl, attachmentLinks.
 */
const LOOPS_TRANSACTIONAL_ID_HELP_FEEDBACK_DEFAULT = "cmqjb6sdh11hr0j2pf1gcg0co";

export function getLoopsTransactionalHelpFeedbackId(): string {
  const v = pickProcessEnv("LOOPS" + "_" + "TRANSACTIONAL" + "_" + "ID" + "_" + "HELP" + "_" + "FEEDBACK");
  return v?.trim() || LOOPS_TRANSACTIONAL_ID_HELP_FEEDBACK_DEFAULT;
}

/** “Trial ends tomorrow” — sent one day before platform trial ends (non-Pro users). */
const LOOPS_TRANSACTIONAL_ID_TRIAL_ENDS_TOMORROW_DEFAULT = "cmreiej710iox0jywmmqplp54";

export function getLoopsTransactionalTrialEndsTomorrowId(): string {
  const v = pickProcessEnv(
    "LOOPS" + "_" + "TRANSACTIONAL" + "_" + "ID" + "_" + "TRIAL" + "_" + "ENDS" + "_" + "TOMORROW",
  );
  return v?.trim() || LOOPS_TRANSACTIONAL_ID_TRIAL_ENDS_TOMORROW_DEFAULT;
}

/** “Trial expired” — sent when platform trial ends and access is locked (non-Pro users). */
const LOOPS_TRANSACTIONAL_ID_TRIAL_EXPIRED_DEFAULT = "cmreiek1w03lx0j3gmtbz8cps";

export function getLoopsTransactionalTrialExpiredId(): string {
  const v = pickProcessEnv("LOOPS" + "_" + "TRANSACTIONAL" + "_" + "ID" + "_" + "TRIAL" + "_" + "EXPIRED");
  return v?.trim() || LOOPS_TRANSACTIONAL_ID_TRIAL_EXPIRED_DEFAULT;
}

/** SnapTrade partner client ID (server-only). */
export function getSnapTradeClientId(): string | undefined {
  const v = pickProcessEnv("SNAPTRADE" + "_" + "CLIENT" + "_" + "ID");
  return v || undefined;
}

/** SnapTrade consumer key (server-only). */
export function getSnapTradeConsumerKey(): string | undefined {
  const v = pickProcessEnv("SNAPTRADE" + "_" + "CONSUMER" + "_" + "KEY");
  return v || undefined;
}
