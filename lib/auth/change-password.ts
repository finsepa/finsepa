"use client";

import { MIN_PASSWORD_LENGTH } from "@/lib/auth/password-rules";

export { MIN_PASSWORD_LENGTH };

export type ChangePasswordResult = { ok: true } | { ok: false; message: string };

export async function changePasswordWithCurrent(args: {
  currentPassword: string;
  newPassword: string;
}): Promise<ChangePasswordResult> {
  const currentPassword = args.currentPassword;
  const newPassword = args.newPassword;

  if (newPassword.length < MIN_PASSWORD_LENGTH) {
    return { ok: false, message: "Password must be at least 8 characters." };
  }

  if (newPassword === currentPassword) {
    return { ok: false, message: "New password must be different from your current password." };
  }

  const res = await fetch("/api/account/change-password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ currentPassword, newPassword }),
  });

  const data = (await res.json().catch(() => ({}))) as { ok?: boolean; message?: string };

  if (!res.ok) {
    return {
      ok: false,
      message: data.message?.trim() || "Something went wrong. Please try again.",
    };
  }

  return { ok: true };
}
