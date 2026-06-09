import { NextResponse } from "next/server";

import { isLocalDevAuthRequest } from "@/lib/auth/local-dev-auth";
import { friendlySupabaseAuthErrorMessage } from "@/lib/auth/supabase-error-message";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Local dev only: password login without Turnstile.
 * Supabase captcha applies to anon-key auth; service-role sign-in bypasses it.
 */
export async function POST(request: Request) {
  if (!isLocalDevAuthRequest(request)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const admin = getSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json(
      {
        error:
          "Local password login needs SUPABASE_SERVICE_ROLE_KEY in .env.local. Restart npm run dev after adding it.",
      },
      { status: 503 },
    );
  }

  let body: { email?: unknown; password?: unknown };
  try {
    body = (await request.json()) as { email?: unknown; password?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const email = typeof body.email === "string" ? body.email.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (!email || !password) {
    return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
  }

  const { data, error } = await admin.auth.signInWithPassword({ email, password });
  if (error) {
    return NextResponse.json(
      { error: friendlySupabaseAuthErrorMessage(error.message) },
      { status: 401 },
    );
  }

  const session = data.session;
  if (!session?.access_token || !session.refresh_token) {
    return NextResponse.json({ error: "No session returned." }, { status: 500 });
  }

  return NextResponse.json({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    expires_in: session.expires_in,
  });
}
