import { NextResponse } from "next/server";

import { MIN_PASSWORD_LENGTH } from "@/lib/auth/password-rules";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  newPassword?: unknown;
};

export async function POST(request: Request) {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) {
    return NextResponse.json({ error: "not_authenticated", message: "Not signed in." }, { status: 401 });
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "invalid_json", message: "Invalid request." }, { status: 400 });
  }

  const newPassword = typeof body.newPassword === "string" ? body.newPassword : "";

  if (!newPassword) {
    return NextResponse.json(
      { error: "missing_fields", message: "Enter a new password." },
      { status: 400 },
    );
  }

  if (newPassword.length < MIN_PASSWORD_LENGTH) {
    return NextResponse.json(
      { error: "weak_password", message: "Password must be at least 8 characters." },
      { status: 400 },
    );
  }

  const admin = getSupabaseAdminClient();
  if (admin) {
    const { error: adminError } = await admin.auth.admin.updateUserById(user.id, {
      password: newPassword,
    });
    if (adminError) {
      return NextResponse.json(
        { error: "update_failed", message: adminError.message || "Could not update password." },
        { status: 400 },
      );
    }
    return NextResponse.json({ ok: true as const });
  }

  const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
  if (updateError) {
    return NextResponse.json(
      { error: "update_failed", message: updateError.message || "Could not update password." },
      { status: 400 },
    );
  }

  return NextResponse.json({ ok: true as const });
}
