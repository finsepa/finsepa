"use client";

import { friendlySupabaseAuthErrorMessage } from "@/lib/auth/supabase-error-message";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

export const MIN_PASSWORD_LENGTH = 8;

export type ChangePasswordResult = { ok: true } | { ok: false; message: string };

export async function changePasswordWithCurrent(args: {
  email: string;
  currentPassword: string;
  newPassword: string;
}): Promise<ChangePasswordResult> {
  const email = args.email.trim();
  const currentPassword = args.currentPassword;
  const newPassword = args.newPassword;

  if (newPassword.length < MIN_PASSWORD_LENGTH) {
    return { ok: false, message: "Password must be at least 8 characters." };
  }

  if (newPassword === currentPassword) {
    return { ok: false, message: "New password must be different from your current password." };
  }

  const supabase = getSupabaseBrowserClient();

  const { error: signInError } = await supabase.auth.signInWithPassword({
    email,
    password: currentPassword,
  });

  if (signInError) {
    const lower = signInError.message.toLowerCase();
    if (lower.includes("invalid login credentials") || lower.includes("invalid credentials")) {
      return { ok: false, message: "Current password is incorrect." };
    }
    return { ok: false, message: friendlySupabaseAuthErrorMessage(signInError.message) };
  }

  const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
  if (updateError) {
    return { ok: false, message: friendlySupabaseAuthErrorMessage(updateError.message) };
  }

  return { ok: true };
}
