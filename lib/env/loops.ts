import "server-only";

/** Env var names to try, in order (Finsepa + common typo). */
const LOOPS_KEY_ENV_NAMES = ["LOOPS_API_KEY", "LOOP_API_KEY"] as const;

/**
 * Loops REST API key for transactional email (`/api/v1/transactional`).
 * Kept in a small module so the key is read at request time, not mixed with unrelated env helpers.
 */
export function getLoopsApiKey(): string | undefined {
  for (const name of LOOPS_KEY_ENV_NAMES) {
    const raw = process.env[name];
    if (typeof raw !== "string") continue;
    const t = raw.replace(/^\uFEFF/, "").trim();
    if (t.length > 0) return t;
  }
  return undefined;
}
