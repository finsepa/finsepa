import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { resolvePostLoginPath } from "@/lib/auth/post-login-redirect";
import { verifyPasswordForEmail } from "@/lib/auth/verify-password-for-email";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  email?: unknown;
  password?: unknown;
  next?: unknown;
};

function getSupabasePublicConfig(): { url: string; anonKey: string } | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
  if (!url || !anonKey) return null;
  return { url, anonKey };
}

type SessionCookie = { name: string; value: string; options?: CookieOptions };

async function createCookieSessionClient() {
  const config = getSupabasePublicConfig();
  if (!config) return null;

  const cookieStore = await cookies();
  const sessionCookies: SessionCookie[] = [];

  const supabase = createServerClient(config.url, config.anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          cookieStore.set(name, value, options);
          sessionCookies.push({ name, value, options });
        });
      },
    },
  });

  return { supabase, sessionCookies };
}

function buildLoginSuccessResponse(redirectTo: string, sessionCookies: SessionCookie[]) {
  const response = NextResponse.json({ ok: true as const, redirectTo });
  sessionCookies.forEach(({ name, value, options }) => {
    response.cookies.set(name, value, options);
  });
  return response;
}

async function loginWithPasswordGrant(
  email: string,
  password: string,
  next?: string | null,
): Promise<NextResponse> {
  const sessionClient = await createCookieSessionClient();
  if (!sessionClient) {
    return NextResponse.json({ error: "config", message: "Authentication is not configured." }, { status: 503 });
  }

  const { supabase, sessionCookies } = sessionClient;
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    const lower = error.message.toLowerCase();
    if (lower.includes("invalid login credentials") || lower.includes("invalid credentials")) {
      return NextResponse.json(
        { error: "invalid_credentials", message: "Invalid email or password." },
        { status: 401 },
      );
    }
    if (lower.includes("captcha")) {
      return NextResponse.json(
        {
          error: "login_unavailable",
          message:
            "Email sign-in is not configured on production yet. Add SUPABASE_POOLER_URL in Vercel (Supabase → Connect → Session pooler), redeploy, and try again.",
        },
        { status: 503 },
      );
    }
    return NextResponse.json(
      { error: "login_failed", message: "Could not sign in. Try again." },
      { status: 400 },
    );
  }

  const redirectTo = await resolvePostLoginPath(supabase, next);
  return buildLoginSuccessResponse(redirectTo, sessionCookies);
}

async function loginWithVerifiedEmail(email: string, next?: string | null): Promise<NextResponse> {
  const admin = getSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json(
      { error: "config", message: "Authentication is not configured." },
      { status: 503 },
    );
  }

  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
  });

  const tokenHash = linkData?.properties?.hashed_token;
  if (linkError || !tokenHash) {
    return NextResponse.json(
      { error: "session_failed", message: "Could not start your session. Try again." },
      { status: 500 },
    );
  }

  const sessionClient = await createCookieSessionClient();
  if (!sessionClient) {
    return NextResponse.json({ error: "config", message: "Authentication is not configured." }, { status: 503 });
  }

  const { supabase, sessionCookies } = sessionClient;
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

  const redirectTo = await resolvePostLoginPath(supabase, next);
  return buildLoginSuccessResponse(redirectTo, sessionCookies);
}

export async function POST(request: Request) {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "invalid_json", message: "Invalid request." }, { status: 400 });
  }

  const email = typeof body.email === "string" ? body.email.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const next = typeof body.next === "string" ? body.next : null;

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

    // Local dev usually has SUPABASE_POOLER_URL; production may not — fall back to Supabase password grant.
    return loginWithPasswordGrant(email, password, next);
  }

  return loginWithVerifiedEmail(verified.email, next);
}
