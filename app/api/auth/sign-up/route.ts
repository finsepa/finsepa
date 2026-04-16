import { NextResponse } from "next/server";

import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const MIN_PASSWORD_LEN = 6;
const MAX_NAME_LEN = 80;

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

type Body = {
  email?: unknown;
  password?: unknown;
  firstName?: unknown;
  lastName?: unknown;
};

/**
 * Creates a confirmed email/password user without sending a confirmation email (avoids Supabase
 * Auth "email rate limit exceeded" on busy IPs). Requires `SUPABASE_SERVICE_ROLE_KEY` on the server.
 */
export async function POST(request: Request) {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const email = String(body.email ?? "")
    .trim()
    .toLowerCase();
  const password = String(body.password ?? "");
  const firstName = String(body.firstName ?? "").trim();
  const lastName = String(body.lastName ?? "").trim();

  if (!firstName || !lastName || firstName.length > MAX_NAME_LEN || lastName.length > MAX_NAME_LEN) {
    return NextResponse.json({ error: "invalid_name" }, { status: 400 });
  }
  if (!isValidEmail(email)) {
    return NextResponse.json({ error: "invalid_email" }, { status: 400 });
  }
  if (password.length < MIN_PASSWORD_LEN || password.length > 256) {
    return NextResponse.json({ error: "invalid_password" }, { status: 400 });
  }

  const admin = getSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "admin_unavailable" }, { status: 503 });
  }

  const { error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      first_name: firstName,
      last_name: lastName,
    },
  });

  if (error) {
    const msg = error.message.toLowerCase();
    if (
      msg.includes("already been registered") ||
      msg.includes("already registered") ||
      msg.includes("user already") ||
      msg.includes("duplicate")
    ) {
      return NextResponse.json({ error: "duplicate_email" }, { status: 409 });
    }
    return NextResponse.json({ error: "create_failed", message: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true as const });
}
