import "server-only";

function decodeEnvNameB64(b64: string): string {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(b64, "base64").toString("utf8");
  }
  return atob(b64);
}

/**
 * Read `process.env[name]` at runtime using a dynamic name.
 * Next.js/Turbopack can inline `process.env.FOO` as `undefined` at build time when `FOO` was not
 * present during `next build`; Vercel still injects secrets at **runtime**, so dynamic lookup avoids
 * that stale `undefined` for server-only variables.
 */
export function pickProcessEnv(name: string): string | undefined {
  if (typeof process === "undefined" || !process.env) return undefined;
  const raw = process.env[name];
  if (typeof raw !== "string") return undefined;
  const t = raw.replace(/^\uFEFF/, "").trim();
  return t.length > 0 ? t : undefined;
}

/**
 * Like `pickProcessEnv`, but the variable name is passed as **base64** so the bundler cannot
 * constant-fold string concatenation into `process.env["LOOPS_API_KEY"]` and inline `undefined`
 * when that secret was not present during `next build` (common for Vercel “encrypted” / runtime-only values).
 */
export function pickProcessEnvB64(nameBase64: string): string | undefined {
  return pickProcessEnv(decodeEnvNameB64(nameBase64));
}
