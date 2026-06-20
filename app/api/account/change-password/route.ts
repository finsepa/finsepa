import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

import { MIN_PASSWORD_LENGTH } from "@/lib/auth/password-rules";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  currentPassword?: unknown;
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

  const currentPassword = typeof body.currentPassword === "string" ? body.currentPassword : "";
  const newPassword = typeof body.newPassword === "string" ? body.newPassword : "";

  if (!currentPassword || !newPassword) {
    return NextResponse.json(
      { error: "missing_fields", message: "Enter your current and new password." },
      { status: 400 },
    );
  }

  if (newPassword.length < MIN_PASSWORD_LENGTH) {
    return NextResponse.json(
      { error: "weak_password", message: "Password must be at least 8 characters." },
      { status: 400 },
    );
  }

  if (currentPassword === newPassword) {
    return NextResponse.json(
      {
        error: "same_password",
        message: "New password must be different from your current password.",
      },
      { status: 400 },
    );
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();

  if (!url || !anonKey) {
    return NextResponse.json({ error: "config", message: "Authentication is not configured." }, { status: 503 });
  }

  const verifyClient = createClient(url, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  const { error: verifyError } = await verifyClient.auth.signInWithPassword({
    email: user.email,
    password: currentPassword,
  });

  if (verifyError) {
    const lower = verifyError.message.toLowerCase();
    if (lower.includes("invalid login credentials") || lower.includes("invalid credentials")) {
      return NextResponse.json(
        { error: "wrong_password", message: "Current password is incorrect." },
        { status: 400 },
      );
    }
    return NextResponse.json(
      {
        error: "verification_failed",
        message: "Could not verify your current password. Try again.",
      },
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
