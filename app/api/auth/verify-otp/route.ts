import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { isEmailOtpEnabledServer } from "@/lib/auth/email-otp-enabled";
import {
  allowOtpVerifyAttempt,
  clearOtpVerifyFailures,
  recordOtpVerifyFailure,
} from "@/lib/auth/otp-rate-limit";
import { resolvePostLoginPath } from "@/lib/auth/post-login-redirect";
import { scheduleWelcomeTrialStartEmailFromHeaders } from "@/lib/auth/welcome-trial-start-on-login";
import {
  supabaseAuthCookieOptions,
  withDurableAuthCookieOptions,
} from "@/lib/supabase/auth-cookie-options";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const OTP_RE = /^\d{6}$/;

type Body = {
  email?: unknown;
  token?: unknown;
  code?: unknown;
  next?: unknown;
};

type SessionCookie = { name: string; value: string; options?: CookieOptions };

function getSupabasePublicConfig(): { url: string; anonKey: string } | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
  if (!url || !anonKey) return null;
  return { url, anonKey };
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

/**
 * Verify email OTP and establish a web session (cookies).
 * Confirms previously unconfirmed emails. Web-only for now (no `client: "ios"`).
 */
export async function POST(request: Request) {
  if (!isEmailOtpEnabledServer()) {
    return NextResponse.json(
      { error: "otp_disabled", message: "Email code sign-in is not enabled." },
      { status: 503 },
    );
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "invalid_json", message: "Invalid request." }, { status: 400 });
  }

  const email = String(body.email ?? "")
    .trim()
    .toLowerCase();
  const token = String(body.token ?? body.code ?? "")
    .trim()
    .replace(/\s+/g, "");
  const next = typeof body.next === "string" ? body.next : null;

  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "invalid_email", message: "Enter a valid email." }, { status: 400 });
  }
  if (!OTP_RE.test(token)) {
    return NextResponse.json(
      { error: "invalid_code", message: "Enter the 6-digit code from your email." },
      { status: 400 },
    );
  }

  const verifyGate = allowOtpVerifyAttempt(email);
  if (!verifyGate.ok) {
    return NextResponse.json(
      {
        error: "rate_limited",
        message: "Too many incorrect codes. Try again later.",
        retryAfterSec: verifyGate.retryAfterSec,
      },
      { status: 429 },
    );
  }

  const sessionClient = await createCookieSessionClient();
  if (!sessionClient) {
    return NextResponse.json(
      { error: "config", message: "Authentication is not configured." },
      { status: 503 },
    );
  }

  const { supabase, sessionCookies } = sessionClient;

  let verifyError = (
    await supabase.auth.verifyOtp({
      email,
      token,
      type: "email",
    })
  ).error;

  if (verifyError) {
    const retry = await supabase.auth.verifyOtp({
      email,
      token,
      type: "magiclink",
    });
    verifyError = retry.error;
  }

  if (verifyError) {
    recordOtpVerifyFailure(email);
    return NextResponse.json(
      { error: "invalid_code", message: "That code is invalid or expired. Try again." },
      { status: 401 },
    );
  }

  clearOtpVerifyFailures(email);

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    scheduleWelcomeTrialStartEmailFromHeaders(user, request.headers);
  }

  const redirectTo = await resolvePostLoginPath(supabase, next);
  const response = NextResponse.json({
    ok: true as const,
    redirectTo,
  });
  sessionCookies.forEach(({ name, value, options: cookieOptions }) => {
    response.cookies.set(name, value, withDurableAuthCookieOptions(cookieOptions));
  });
  return response;
}
