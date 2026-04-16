import { NextResponse } from "next/server";

import { getLoopsApiKey, getLoopsTransactionalSignupId } from "@/lib/env/server";
import { PATH_APP_ENTRY, PATH_AUTH_CALLBACK } from "@/lib/auth/routes";
import { sendLoopsSignupConfirmationEmail } from "@/lib/loops/send-signup-confirmation";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MIN_PASSWORD_LEN = 6;

function hintForGenerateLinkError(message: string, redirectTo: string): string {
  const m = message.toLowerCase();
  if (
    m.includes("redirect") ||
    m.includes("url") ||
    m.includes("not allowed") ||
    m.includes("invalid request")
  ) {
    return `${message} — In Supabase Dashboard → Authentication → URL Configuration, add this exact redirect to “Redirect URLs”: ${redirectTo}`;
  }
  return message;
}

/** GET: whether Loops + service role are configured (no secrets). Useful for debugging prod/local env. */
export async function GET() {
  const loopsKey = getLoopsApiKey();
  const admin = getSupabaseAdminClient();
  return NextResponse.json({
    loopsConfigured: Boolean(loopsKey),
    adminConfigured: Boolean(admin),
  });
}

const MAX_NAME_LEN = 80;

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

type Body = {
  email?: unknown;
  password?: unknown;
  firstName?: unknown;
  lastName?: unknown;
  /** e.g. https://app.finsepa.com — used for Supabase redirect_to in the confirmation link */
  appOrigin?: unknown;
};

/**
 * When Supabase “custom SMTP” cannot send auth mail, creates the user + confirmation link via
 * Admin `generateLink` (no email from Supabase) and delivers the link with Loops transactional API.
 */
export async function POST(request: Request) {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const loopsKey = getLoopsApiKey();
  const loopsTxId = getLoopsTransactionalSignupId();
  if (!loopsKey) {
    return NextResponse.json({ error: "loops_not_configured" }, { status: 503 });
  }

  const email = String(body.email ?? "")
    .trim()
    .toLowerCase();
  const password = String(body.password ?? "");
  const firstName = String(body.firstName ?? "").trim();
  const lastName = String(body.lastName ?? "").trim();
  const appOrigin = String(body.appOrigin ?? "").trim().replace(/\/$/, "");

  if (!firstName || !lastName || firstName.length > MAX_NAME_LEN || lastName.length > MAX_NAME_LEN) {
    return NextResponse.json({ error: "invalid_name" }, { status: 400 });
  }
  if (!isValidEmail(email)) {
    return NextResponse.json({ error: "invalid_email" }, { status: 400 });
  }
  if (password.length < MIN_PASSWORD_LEN || password.length > 256) {
    return NextResponse.json({ error: "invalid_password" }, { status: 400 });
  }
  if (!appOrigin.startsWith("http://") && !appOrigin.startsWith("https://")) {
    return NextResponse.json({ error: "invalid_origin" }, { status: 400 });
  }

  const admin = getSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "admin_unavailable" }, { status: 503 });
  }

  const redirectTo = `${appOrigin}${PATH_AUTH_CALLBACK}?next=${encodeURIComponent(PATH_APP_ENTRY)}`;

  const { data, error } = await admin.auth.admin.generateLink({
    type: "signup",
    email,
    password,
    options: {
      redirectTo,
      data: {
        first_name: firstName,
        last_name: lastName,
      },
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
    return NextResponse.json(
      { error: "generate_link_failed", message: hintForGenerateLinkError(error.message, redirectTo) },
      { status: 400 },
    );
  }

  const actionLink =
    (data?.properties as { action_link?: string } | undefined)?.action_link ??
    (data as { action_link?: string } | undefined)?.action_link;

  if (!actionLink || typeof actionLink !== "string") {
    return NextResponse.json({ error: "missing_action_link" }, { status: 500 });
  }

  const sent = await sendLoopsSignupConfirmationEmail({
    apiKey: loopsKey,
    transactionalId: loopsTxId,
    to: email,
    confirmationLink: actionLink,
    firstName,
  });

  if (!sent.ok) {
    return NextResponse.json({ error: "loops_send_failed", message: sent.message }, { status: 502 });
  }

  return NextResponse.json({ ok: true as const });
}
