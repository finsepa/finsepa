import { NextResponse } from "next/server";

import { resolveAuthUserFromRequest } from "@/lib/auth/resolve-auth-user";
import { sendWelcomeTrialStartEmailIfNeeded } from "@/lib/auth/send-welcome-trial-start-email";
import { getLoopsApiKey } from "@/lib/env/loops";
import { getLoopsTransactionalWelcomeTrialStartId } from "@/lib/env/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Debug: GET /api/auth/welcome-trial-start — confirms Loops + admin env on this deployment. */
export async function GET() {
  return NextResponse.json({
    loopsConfigured: Boolean(getLoopsApiKey()),
    welcomeTrialStartTemplateId: getLoopsTransactionalWelcomeTrialStartId(),
    adminConfigured: Boolean(getSupabaseAdminClient()),
  });
}

/**
 * Sends the Welcome Trial Start Loops email once per user (Google sign-up or after email confirm).
 * Called from `/auth/callback`, onboarding bootstrap, and first protected page load.
 */
export async function POST(request: Request) {
  const sessionUser = await resolveAuthUserFromRequest(request);

  if (!sessionUser) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let user = sessionUser;
  const admin = getSupabaseAdminClient();
  if (admin) {
    const { data: adminUser, error } = await admin.auth.admin.getUserById(sessionUser.id);
    if (!error && adminUser?.user) {
      user = adminUser.user;
    }
  }

  const origin = request.headers.get("origin") ?? "";
  const result = await sendWelcomeTrialStartEmailIfNeeded(user, origin);

  if (!result.sent && result.reason === "send_failed") {
    console.error("[welcome-trial-start]", result.message);
  }

  return NextResponse.json({
    ok: true,
    sent: result.sent,
    reason: result.sent ? undefined : result.reason,
    message: result.sent ? undefined : result.message,
  });
}
