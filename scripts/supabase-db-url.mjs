/**
 * Builds a Postgres connection string for Supabase CLI-style scripts.
 *
 * Prefer **Session pooler** when `SUPABASE_POOLER_HOST` or `SUPABASE_POOLER_REGION` is set:
 * direct `db.<ref>.supabase.co` often resolves to IPv6-only DNS; many networks can't reach it (ETIMEDOUT).
 *
 * Copy host from Supabase Dashboard → Connect → **Session pooler** (port 5432), or set region only:
 *   SUPABASE_POOLER_REGION=eu-central-1  → aws-0-eu-central-1.pooler.supabase.com
 */

function pickDatabaseUrl() {
  const keys = ["DATABASE_URL", "DIRECT_URL", "POSTGRES_URL", "SUPABASE_DATABASE_URL"];
  for (const k of keys) {
    const v = process.env[k]?.trim();
    if (v) return v;
  }
  return null;
}

/** Paste full URI from Supabase Dashboard → Connect → Session pooler (most reliable). */
function pickPoolerUrl() {
  const v = process.env.SUPABASE_POOLER_URL?.trim();
  return v || null;
}

/** e.g. https://abcdefgh.supabase.co → abcdefgh */
export function extractSupabaseProjectRef(url) {
  if (!url || typeof url !== "string") return null;
  const m = url.trim().match(/^https?:\/\/([a-z0-9-]+)\.supabase\.co\/?$/i);
  return m ? m[1] : null;
}

export function buildDirectPostgresUrl() {
  const ref = extractSupabaseProjectRef(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const pwd = process.env.SUPABASE_DB_PASSWORD?.trim() ?? process.env.POSTGRES_PASSWORD?.trim();
  if (!ref || !pwd) return null;
  const user = process.env.SUPABASE_DB_USER?.trim() || "postgres";
  return `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(pwd)}@db.${ref}.supabase.co:5432/postgres`;
}

/**
 * Resolution order:
 * 1) SUPABASE_POOLER_URL — paste from Dashboard → Connect (exact host, often aws-1-… not aws-0-…)
 * 2) Built pooler URL from SUPABASE_POOLER_HOST or SUPABASE_POOLER_REGION + SUPABASE_POOLER_AWS_INDEX (0 or 1)
 * 3) DATABASE_URL / …
 * 4) Direct db.<ref>.supabase.co (IPv6-only on many networks)
 */
export function resolveSupabaseDatabaseUrl() {
  const awsIdx = process.env.SUPABASE_POOLER_AWS_INDEX?.trim() || "0";
  const region = process.env.SUPABASE_POOLER_REGION?.trim();
  const hostOverride = process.env.SUPABASE_POOLER_HOST?.trim();
  const builtHost =
    hostOverride ||
    (region ? `aws-${awsIdx}-${region}.pooler.supabase.com` : null);
  const poolerFromParts =
    builtHost && process.env.SUPABASE_DB_PASSWORD?.trim()
      ? (() => {
          const ref = extractSupabaseProjectRef(process.env.NEXT_PUBLIC_SUPABASE_URL);
          const pwd = process.env.SUPABASE_DB_PASSWORD.trim();
          if (!ref) return null;
          const port = process.env.SUPABASE_POOLER_PORT?.trim() || "5432";
          return `postgresql://${encodeURIComponent(`postgres.${ref}`)}:${encodeURIComponent(pwd)}@${builtHost}:${port}/postgres`;
        })()
      : null;

  return pickPoolerUrl() ?? poolerFromParts ?? pickDatabaseUrl() ?? buildDirectPostgresUrl();
}
