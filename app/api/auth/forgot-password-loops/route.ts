import { NextResponse } from "next/server";

import { resolveAuthAppOriginForServer } from "@/lib/auth/app-origin";
import { PATH_AUTH_RESET_PASSWORD } from "@/lib/auth/routes";
import { getLoopsApiKey } from "@/lib/env/loops";
import { getLoopsTransactionalPasswordResetId } from "@/lib/env/server";
import { sendLoopsTransactionalAuthEmail } from "@/lib/loops/transactional";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

import type { User } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function firstNameForEmail(user: User | null | undefined, email: string): string {
  const meta = user?.user_metadata;
  if (meta && typeof meta === "object") {
    const fn = (meta as Record<string, unknown>).first_name;
    if (typeof fn === "string" && fn.trim()) return fn.trim().slice(0, 80);
  }
  const local = email.split("@")[0]?.trim() || "there";
  return local.slice(0, 80) || "there";
}

/** No user enumeration: treat as missing when recovery link cannot be created for this reason. */
function isUserMissingForRecovery(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes("user not found") ||
    m.includes("no user found") ||
    m.includes("email not found") ||
    (m.includes("not found") && m.includes("user"))
  );
}

type Body = {
  email?: unknown;
  /** e.g. https://app.finsepa.com — used for Supabase `redirect_to` in the recovery link */
  appOrigin?: unknown;
};

/**
 * When Loops + service role are configured: `generateLink` (recovery) + Loops transactional
 * (same `firstName` / `confirmationLink` variables as sign-up email).
 */
export async function POST(request: Request) {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const loopsKey = getLoopsApiKey();
  const loopsTxId = getLoopsTransactionalPasswordResetId();
  if (!loopsKey) {
    return NextResponse.json({ error: "loops_not_configured" }, { status: 503 });
  }

  const email = String(body.email ?? "")
    .trim()
    .toLowerCase();
  const appOrigin = resolveAuthAppOriginForServer(String(body.appOrigin ?? ""));

  if (!isValidEmail(email)) {
    return NextResponse.json({ error: "invalid_email" }, { status: 400 });
  }
  if (!appOrigin.startsWith("http://") && !appOrigin.startsWith("https://")) {
    return NextResponse.json({ error: "invalid_origin" }, { status: 400 });
  }

  const admin = getSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "admin_unavailable" }, { status: 503 });
  }

  const redirectTo = `${appOrigin}${PATH_AUTH_RESET_PASSWORD}`;

  const { data, error } = await admin.auth.admin.generateLink({
    type: "recovery",
    email,
    options: {
      redirectTo,
    },
  });

  if (error) {
    if (isUserMissingForRecovery(error.message)) {
      return NextResponse.json({ ok: true as const });
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

  const user = data?.user as User | undefined;
  const firstName = firstNameForEmail(user ?? null, email);

  const sent = await sendLoopsTransactionalAuthEmail({
    apiKey: loopsKey,
    transactionalId: loopsTxId,
    to: email,
    confirmationLink: actionLink,
    firstName,
    errorHint:
      "Check LOOPS_API_KEY, LOOPS_TRANSACTIONAL_ID_PASSWORD_RESET, and template variables firstName + confirmationLink.",
  });

  if (!sent.ok) {
    return NextResponse.json({ error: "loops_send_failed", message: sent.message }, { status: 502 });
  }

  return NextResponse.json({ ok: true as const });
}
