import "server-only";

import { compare } from "bcryptjs";
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

export type VerifyCurrentPasswordResult =
  | { ok: true }
  | { ok: false; reason: "wrong_password" | "unavailable" };

export async function verifyCurrentPasswordForUser(
  userId: string,
  password: string,
): Promise<VerifyCurrentPasswordResult> {
  const db = getPool();
  if (!db) return { ok: false, reason: "unavailable" };

  try {
    const { rows } = await db.query<{ encrypted_password: string | null }>(
      "select encrypted_password from auth.users where id = $1::uuid and deleted_at is null limit 1",
      [userId],
    );

    const hash = rows[0]?.encrypted_password;
    if (!hash) return { ok: false, reason: "wrong_password" };

    const matches = await compare(password, hash);
    return matches ? { ok: true } : { ok: false, reason: "wrong_password" };
  } catch {
    return { ok: false, reason: "unavailable" };
  }
}
