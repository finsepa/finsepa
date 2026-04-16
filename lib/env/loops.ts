import "server-only";

/**
 * Loops REST API key for transactional email (`/api/v1/transactional`).
 *
 * Read via **computed property names** (`"LOOPS" + "_API_KEY"`) so Next/Turbopack does not inline
 * `undefined` at build time when the secret was not present during `next build` (a known issue on
 * Vercel if env is only guaranteed at runtime). Runtime `process.env` from Vercel still resolves.
 */
function pickEnv(name: string): string | undefined {
  if (typeof process === "undefined" || !process.env) return undefined;
  const raw = process.env[name];
  if (typeof raw !== "string") return undefined;
  const t = raw.replace(/^\uFEFF/, "").trim();
  return t.length > 0 ? t : undefined;
}

export function getLoopsApiKey(): string | undefined {
  const primary = pickEnv("LOOPS" + "_" + "API" + "_" + "KEY");
  if (primary) return primary;
  return pickEnv("LOOP" + "_" + "API" + "_" + "KEY");
}
