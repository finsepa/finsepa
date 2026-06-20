"use client";

import { getAuthAppOriginForClient } from "@/lib/auth/app-origin";
import { PATH_AUTH_RESET_PASSWORD } from "@/lib/auth/routes";
import { friendlySupabaseAuthErrorMessage } from "@/lib/auth/supabase-error-message";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

export type PasswordResetRequestResult = { ok: true } | { ok: false; message: string };

export async function requestPasswordResetEmail(email: string): Promise<PasswordResetRequestResult> {
  const trimmed = email.trim();
  const apiOrigin = typeof window !== "undefined" ? window.location.origin : "";
  const authOrigin = getAuthAppOriginForClient();

  let loopsRes: Response | null = null;
  try {
    loopsRes = await fetch(`${apiOrigin}/api/auth/forgot-password-loops`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: trimmed, appOrigin: authOrigin }),
    });
  } catch {
    loopsRes = null;
  }

  const loopsJson = loopsRes
    ? ((await loopsRes.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        message?: string;
      })
    : {};

  if (loopsRes?.ok && loopsJson.ok === true) {
    return { ok: true };
  }

  const useSupabaseFallback =
    loopsRes === null ||
    loopsJson.error === "loops_not_configured" ||
    loopsJson.error === "admin_unavailable";

  if (useSupabaseFallback) {
    const supabase = getSupabaseBrowserClient();
    const redirectTo = `${apiOrigin}${PATH_AUTH_RESET_PASSWORD}`;

    const { error } = await supabase.auth.resetPasswordForEmail(trimmed, {
      redirectTo,
    });

    if (error) {
      return { ok: false, message: friendlySupabaseAuthErrorMessage(error.message) };
    }

    return { ok: true };
  }

  return {
    ok: false,
    message:
      loopsJson.message?.trim() ||
      "We could not send the reset email. Try again or contact support if this continues.",
  };
}
