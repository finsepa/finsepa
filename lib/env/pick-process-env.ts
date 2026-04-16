import "server-only";

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
