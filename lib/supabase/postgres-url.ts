import "server-only";

import { pickProcessEnv } from "@/lib/env/pick-process-env";

function extractSupabaseProjectRef(url: string | undefined): string | null {
  if (!url) return null;
  const match = url.trim().match(/^https?:\/\/([a-z0-9-]+)\.supabase\.co\/?$/i);
  return match ? match[1] : null;
}

export function resolveSupabaseDatabaseUrl(): string | null {
  for (const key of [
    "SUPABASE_POOLER_URL",
    "DATABASE_URL",
    "DIRECT_URL",
    "POSTGRES_URL",
    "SUPABASE_DATABASE_URL",
  ]) {
    const value = pickProcessEnv(key);
    if (value) return value;
  }

  const ref = extractSupabaseProjectRef(pickProcessEnv("NEXT_PUBLIC_SUPABASE_URL"));
  const password = pickProcessEnv("SUPABASE_DB_PASSWORD") ?? pickProcessEnv("POSTGRES_PASSWORD");
  const region = pickProcessEnv("SUPABASE_POOLER_REGION");
  const hostOverride = pickProcessEnv("SUPABASE_POOLER_HOST");
  const awsIndex = pickProcessEnv("SUPABASE_POOLER_AWS_INDEX") ?? "0";

  if (password && ref) {
    const host =
      hostOverride || (region ? `aws-${awsIndex}-${region}.pooler.supabase.com` : `db.${ref}.supabase.co`);
    const port = pickProcessEnv("SUPABASE_POOLER_PORT") ?? "5432";
    const user = pickProcessEnv("SUPABASE_DB_USER") ?? "postgres";
    return `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/postgres`;
  }

  return null;
}
