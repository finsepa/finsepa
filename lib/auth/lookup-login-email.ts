import "server-only";

import { Pool } from "pg";

import { resolveSupabaseDatabaseUrl } from "@/lib/supabase/postgres-url";

let pool: Pool | null = null;

function getPool(): Pool | null {
  const connectionString = resolveSupabaseDatabaseUrl();
  if (!connectionString) return null;
  if (!pool) {
    pool = new Pool({
      connectionString,
      max: 2,
      ssl: connectionString.includes("localhost") ? undefined : { rejectUnauthorized: false },
    });
  }
  return pool;
}

export type LookupLoginEmailResult =
  | { ok: true; exists: false }
  | { ok: true; exists: true; googleOnly: boolean }
  | { ok: false; reason: "unavailable" };

/**
 * Lightweight auth.users existence check for progressive login.
 * Returns googleOnly when the user has no encrypted_password (OAuth-only).
 */
export async function lookupLoginEmail(email: string): Promise<LookupLoginEmailResult> {
  const db = getPool();
  const normalizedEmail = email.trim().toLowerCase();
  if (!db || !normalizedEmail) {
    return { ok: false, reason: "unavailable" };
  }

  try {
    const { rows } = await db.query<{ encrypted_password: string | null }>(
      `select encrypted_password
       from auth.users
       where lower(email) = $1 and deleted_at is null
       limit 1`,
      [normalizedEmail],
    );

    const row = rows[0];
    if (!row) return { ok: true, exists: false };

    const hash = row.encrypted_password;
    return { ok: true, exists: true, googleOnly: !hash };
  } catch {
    return { ok: false, reason: "unavailable" };
  }
}
