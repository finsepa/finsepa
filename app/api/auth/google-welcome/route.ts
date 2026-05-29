import { NextResponse } from "next/server";

import { sendGoogleWelcomeEmailIfNeeded } from "@/lib/auth/send-google-welcome-email";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
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
    data: { user: sessionUser },
  } = await supabase.auth.getUser();

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
  const result = await sendGoogleWelcomeEmailIfNeeded(user, origin);

  return NextResponse.json({
    ok: true,
    sent: result.sent,
    reason: result.sent ? undefined : result.reason,
    message: result.sent ? undefined : result.message,
  });
}
