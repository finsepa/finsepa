import { NextResponse } from "next/server";

import { sendGoogleWelcomeEmailIfNeeded } from "@/lib/auth/send-google-welcome-email";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Sends the Google OAuth welcome email once per user (Loops transactional).
 * Called from `/auth/callback` after session is established — not for email/password sign-up.
 */
export async function POST(request: Request) {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const origin = request.headers.get("origin") ?? "";
  const result = await sendGoogleWelcomeEmailIfNeeded(user, origin);

  return NextResponse.json({
    ok: true,
    sent: result.sent,
    reason: result.sent ? undefined : result.reason,
    message: result.sent ? undefined : result.message,
  });
}
