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

export type VerifyPasswordForEmailResult =
  | { ok: true; userId: string; email: string }
  | { ok: false; reason: "wrong_password" | "google_only" | "unavailable" };

export async function verifyPasswordForEmail(
  email: string,
  password: string,
): Promise<VerifyPasswordForEmailResult> {
  const db = getPool();
  const normalizedEmail = email.trim().toLowerCase();
  if (!db || !normalizedEmail || !password) {
    return { ok: false, reason: "unavailable" };
  }

  try {
    const { rows } = await db.query<{ id: string; email: string | null; encrypted_password: string | null }>(
      `select id, email, encrypted_password
       from auth.users
       where lower(email) = $1 and deleted_at is null
       limit 1`,
      [normalizedEmail],
    );

    const row = rows[0];
    if (!row) return { ok: false, reason: "wrong_password" };

    const hash = row.encrypted_password;
    if (!hash) return { ok: false, reason: "google_only" };

    const matches = await compare(password, hash);
    if (!matches) return { ok: false, reason: "wrong_password" };

    return { ok: true, userId: row.id, email: row.email ?? normalizedEmail };
  } catch {
    return { ok: false, reason: "unavailable" };
  }
}
