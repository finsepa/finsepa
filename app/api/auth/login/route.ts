import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { resolvePostLoginPath } from "@/lib/auth/post-login-redirect";
import { verifyPasswordForEmail } from "@/lib/auth/verify-password-for-email";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  supabaseAuthCookieOptions,
  withDurableAuthCookieOptions,
} from "@/lib/supabase/auth-cookie-options";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  email?: unknown;
  password?: unknown;
  next?: unknown;
  /** When `"ios"`, return tokens only — no Set-Cookie (keeps web sessions independent). */
  client?: unknown;
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

/** Ephemeral Auth client for native login — never reads/writes browser cookies. */
function createMemoryAuthClient(): SupabaseClient | null {
  const config = getSupabasePublicConfig();
  if (!config) return null;
  return createClient(config.url, config.anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

async function createCookieSessionClient() {
  const config = getSupabasePublicConfig();
  if (!config) return null;

  const cookieStore = await cookies();
  const sessionCookies: SessionCookie[] = [];

  const supabase = createServerClient(config.url, config.anonKey, {
    cookieOptions: supabaseAuthCookieOptions,
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          const durable = withDurableAuthCookieOptions(options);
          cookieStore.set(name, value, durable);
          sessionCookies.push({ name, value, options: durable });
        });
      },
    },
  });

  return { supabase, sessionCookies };
}

function buildWebLoginSuccessResponse(
  redirectTo: string,
  sessionCookies: SessionCookie[],
) {
  const response = NextResponse.json({
    ok: true as const,
    redirectTo,
  });
  sessionCookies.forEach(({ name, value, options: cookieOptions }) => {
    response.cookies.set(name, value, withDurableAuthCookieOptions(cookieOptions));
  });
  return response;
}

function buildNativeLoginSuccessResponse(
  redirectTo: string,
  session: { access_token: string; refresh_token: string },
) {
  return NextResponse.json({
    ok: true as const,
    redirectTo,
    access_token: session.access_token,
    refresh_token: session.refresh_token,
  });
}

function passwordGrantErrorResponse(error: { message: string }): NextResponse {
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

async function establishVerifiedEmailSession(
  supabase: SupabaseClient,
  email: string,
): Promise<{ ok: true } | { ok: false; response: NextResponse }> {
  const admin = getSupabaseAdminClient();
  if (!admin) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "config", message: "Authentication is not configured." },
        { status: 503 },
      ),
    };
  }

  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
  });

  const tokenHash = linkData?.properties?.hashed_token;
  if (linkError || !tokenHash) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "session_failed", message: "Could not start your session. Try again." },
        { status: 500 },
      ),
    };
  }

  const { error: sessionError } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type: "magiclink",
  });

  if (sessionError) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "session_failed", message: "Could not start your session. Try again." },
        { status: 500 },
      ),
    };
  }

  return { ok: true };
}

/** Native (iOS): independent session + tokens only — does not Set-Cookie on the browser. */
async function loginNativeWithPasswordGrant(
  email: string,
  password: string,
  next?: string | null,
): Promise<NextResponse> {
  const supabase = createMemoryAuthClient();
  if (!supabase) {
    return NextResponse.json({ error: "config", message: "Authentication is not configured." }, { status: 503 });
  }

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return passwordGrantErrorResponse(error);

  const session = data.session;
  if (!session?.access_token || !session.refresh_token) {
    return NextResponse.json(
      { error: "session_failed", message: "Could not start your session. Try again." },
      { status: 500 },
    );
  }

  const redirectTo = await resolvePostLoginPath(supabase, next);
  return buildNativeLoginSuccessResponse(redirectTo, session);
}

async function loginNativeWithVerifiedEmail(
  email: string,
  next?: string | null,
): Promise<NextResponse> {
  const supabase = createMemoryAuthClient();
  if (!supabase) {
    return NextResponse.json({ error: "config", message: "Authentication is not configured." }, { status: 503 });
  }

  const established = await establishVerifiedEmailSession(supabase, email);
  if (!established.ok) return established.response;

  const { data: sessionData } = await supabase.auth.getSession();
  const session = sessionData.session;
  if (!session?.access_token || !session.refresh_token) {
    return NextResponse.json(
      { error: "session_failed", message: "Could not start your session. Try again." },
      { status: 500 },
    );
  }

  const redirectTo = await resolvePostLoginPath(supabase, next);
  return buildNativeLoginSuccessResponse(redirectTo, session);
}

async function loginWebWithPasswordGrant(
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
  if (error) return passwordGrantErrorResponse(error);

  const redirectTo = await resolvePostLoginPath(supabase, next);
  return buildWebLoginSuccessResponse(redirectTo, sessionCookies);
}

async function loginWebWithVerifiedEmail(
  email: string,
  next?: string | null,
): Promise<NextResponse> {
  const sessionClient = await createCookieSessionClient();
  if (!sessionClient) {
    return NextResponse.json({ error: "config", message: "Authentication is not configured." }, { status: 503 });
  }

  const { supabase, sessionCookies } = sessionClient;
  const established = await establishVerifiedEmailSession(supabase, email);
  if (!established.ok) return established.response;

  const redirectTo = await resolvePostLoginPath(supabase, next);
  return buildWebLoginSuccessResponse(redirectTo, sessionCookies);
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
  const isNative = body.client === "ios";

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
          message: "This account uses Apple or Google sign-in. Continue with Apple or Google instead.",
        },
        { status: 400 },
      );
    }
    if (verified.reason === "email_unconfirmed") {
      return NextResponse.json(
        {
          error: "email_unconfirmed",
          message: "Confirm your email before signing in. Check your inbox for the link.",
        },
        { status: 403 },
      );
    }
    if (verified.reason === "wrong_password") {
      return NextResponse.json(
        { error: "invalid_credentials", message: "Invalid email or password." },
        { status: 401 },
      );
    }

    // Local dev usually has SUPABASE_POOLER_URL; production may not — fall back to Supabase password grant.
    return isNative
      ? loginNativeWithPasswordGrant(email, password, next)
      : loginWebWithPasswordGrant(email, password, next);
  }

  return isNative
    ? loginNativeWithVerifiedEmail(verified.email, next)
    : loginWebWithVerifiedEmail(verified.email, next);
}
