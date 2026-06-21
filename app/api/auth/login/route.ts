import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { verifyPasswordForEmail } from "@/lib/auth/verify-password-for-email";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  email?: unknown;
  password?: unknown;
};

export async function POST(request: Request) {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "invalid_json", message: "Invalid request." }, { status: 400 });
  }

  const email = typeof body.email === "string" ? body.email.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (!email || !password) {
    return NextResponse.json(
      { error: "missing_fields", message: "Enter your email and password." },
      { status: 400 },
    );
  }

  const verified = await verifyPasswordForEmail(email, password);
  if (!verified.ok) {
    if (verified.reason === "google_only") {
      return NextResponse.json(
        {
          error: "google_only",
          message: "This account uses Google sign-in. Continue with Google instead.",
        },
        { status: 400 },
      );
    }
    if (verified.reason === "wrong_password") {
      return NextResponse.json(
        { error: "invalid_credentials", message: "Invalid email or password." },
        { status: 401 },
      );
    }
    return NextResponse.json(
      {
        error: "login_unavailable",
        message: "Email sign-in is temporarily unavailable. Try Google sign-in or try again later.",
      },
      { status: 503 },
    );
  }

  const admin = getSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json(
      { error: "config", message: "Authentication is not configured." },
      { status: 503 },
    );
  }

  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: verified.email,
  });

  const tokenHash = linkData?.properties?.hashed_token;
  if (linkError || !tokenHash) {
    return NextResponse.json(
      { error: "session_failed", message: "Could not start your session. Try again." },
      { status: 500 },
    );
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();

  if (!url || !anonKey) {
    return NextResponse.json({ error: "config", message: "Authentication is not configured." }, { status: 503 });
  }

  const cookieStore = await cookies();
  let response = NextResponse.json({ ok: true as const });

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          cookieStore.set(name, value, options);
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const { error: sessionError } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type: "magiclink",
  });

  if (sessionError) {
    return NextResponse.json(
      { error: "session_failed", message: "Could not start your session. Try again." },
      { status: 500 },
    );
  }

  return response;
}
