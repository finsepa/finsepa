import { NextResponse } from "next/server";

import { isEmailOtpEnabledServer } from "@/lib/auth/email-otp-enabled";
import { lookupLoginEmail } from "@/lib/auth/lookup-login-email";
import { allowOtpSend, OTP_SEND_COOLDOWN_SEC } from "@/lib/auth/otp-rate-limit";
import { clientIpFromRequest, isSignupDisabled } from "@/lib/auth/signup-guard";
import { getLoopsApiKey } from "@/lib/env/loops";
import { getLoopsTransactionalEmailOtpId } from "@/lib/env/server";
import { sendLoopsEmailOtpEmail } from "@/lib/loops/send-email-otp";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Body = {
  email?: unknown;
};

function firstNameFromEmail(email: string): string {
  const local = email.split("@")[0]?.trim() || "there";
  return local.slice(0, 80) || "there";
}

/**
 * Send a 6-digit email login code via Admin `generateLink` + Loops.
 * Google-only accounts are rejected; unknown emails create a user unless signup is disabled.
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
  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "invalid_email", message: "Enter a valid email." }, { status: 400 });
  }

  const ip = clientIpFromRequest(request);
  const rate = allowOtpSend(ip, email);
  if (!rate.ok) {
    const message =
      rate.reason === "cooldown" ?
        `Wait ${rate.retryAfterSec}s before requesting another code.`
      : "Too many code requests. Try again later.";
    return NextResponse.json(
      { error: "rate_limited", message, retryAfterSec: rate.retryAfterSec },
      { status: 429 },
    );
  }

  const lookup = await lookupLoginEmail(email);
  if (lookup.ok && lookup.exists && lookup.googleOnly) {
    return NextResponse.json(
      {
        error: "google_only",
        message: "This account uses Google sign-in. Continue with Google instead.",
      },
      { status: 400 },
    );
  }

  if (lookup.ok && !lookup.exists && isSignupDisabled()) {
    // Anti-enumeration: look successful, but do not create/send while sign-ups are paused.
    return NextResponse.json({
      ok: true as const,
      cooldownSec: rate.cooldownSec || OTP_SEND_COOLDOWN_SEC,
    });
  }

  if (!lookup.ok && isSignupDisabled()) {
    // Pooler down + signup kill switch — refuse rather than risk open create via generateLink.
    return NextResponse.json(
      {
        error: "signup_disabled",
        message: "New sign-ups are temporarily paused. Try again later or continue with Google.",
      },
      { status: 503 },
    );
  }

  const loopsKey = getLoopsApiKey();
  const loopsTxId = getLoopsTransactionalEmailOtpId();
  if (!loopsKey || !loopsTxId) {
    return NextResponse.json(
      {
        error: "loops_not_configured",
        message:
          "Email code delivery is not configured. Set LOOPS_API_KEY and LOOPS_TRANSACTIONAL_ID_EMAIL_OTP.",
      },
      { status: 503 },
    );
  }

  const admin = getSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json(
      { error: "admin_unavailable", message: "Authentication is not configured." },
      { status: 503 },
    );
  }

  const { data, error } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
    options: {
      data: {
        onboarding_pending: true,
      },
    },
  });

  if (error) {
    console.error("[send-otp] generateLink", error.message);
    return NextResponse.json(
      { error: "send_failed", message: "Could not send a code. Try again." },
      { status: 500 },
    );
  }

  const props = data?.properties as { email_otp?: string } | undefined;
  const otpCode = typeof props?.email_otp === "string" ? props.email_otp.trim() : "";
  if (!/^\d{6}$/.test(otpCode)) {
    console.error("[send-otp] expected 6-digit email_otp, got length", otpCode.length);
    return NextResponse.json(
      { error: "send_failed", message: "Could not send a code. Try again." },
      { status: 500 },
    );
  }

  let firstName = firstNameFromEmail(email);
  try {
    const userId = data?.user?.id;
    if (userId) {
      const { data: userData } = await admin.auth.admin.getUserById(userId);
      const meta = (userData.user?.user_metadata ?? {}) as Record<string, unknown>;
      const fn = meta.first_name;
      if (typeof fn === "string" && fn.trim()) firstName = fn.trim().slice(0, 80);
    }
  } catch {
    /* keep email local-part */
  }

  const sent = await sendLoopsEmailOtpEmail({
    apiKey: loopsKey,
    transactionalId: loopsTxId,
    to: email,
    otpCode,
    firstName,
  });

  if (!sent.ok) {
    console.error("[send-otp] loops", sent.message);
    return NextResponse.json(
      { error: "loops_send_failed", message: sent.message },
      { status: 502 },
    );
  }

  return NextResponse.json({
    ok: true as const,
    cooldownSec: rate.cooldownSec || OTP_SEND_COOLDOWN_SEC,
  });
}
