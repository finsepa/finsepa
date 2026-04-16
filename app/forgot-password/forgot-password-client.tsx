"use client";

import { useState, type FormEvent } from "react";
import { AuthInput, AuthLabel, AuthPrimaryButton } from "@/components/auth/auth-form-ui";
import { PATH_AUTH_CALLBACK, PATH_AUTH_RESET_PASSWORD } from "@/lib/auth/routes";
import { friendlySupabaseAuthErrorMessage } from "@/lib/auth/supabase-error-message";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

export function ForgotPasswordClient() {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrorMessage(null);

    const form = e.currentTarget;
    const fd = new FormData(form);
    const email = String(fd.get("email") ?? "").trim();

    setLoading(true);
    try {
      const supabase = getSupabaseBrowserClient();
      const origin = window.location.origin;
      const next = encodeURIComponent(PATH_AUTH_RESET_PASSWORD);
      const redirectTo = `${origin}${PATH_AUTH_CALLBACK}?next=${next}`;

      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });

      if (error) {
        setErrorMessage(friendlySupabaseAuthErrorMessage(error.message));
        return;
      }

      setSent(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong. Please try again.";
      setErrorMessage(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {sent ? (
        <div
          role="status"
          className="rounded-[10px] border border-[#BBF7D0] bg-[#F0FDF4] px-3 py-3 text-sm leading-6 text-[#166534]"
        >
          Check your email for reset instructions. If you don&apos;t see it, look in spam or try again in a few minutes.
        </div>
      ) : (
        <form className="space-y-4" onSubmit={handleSubmit} noValidate>
          {errorMessage ? (
            <div
              role="alert"
              className="rounded-[10px] border border-[#FECACA] bg-[#FEF2F2] px-3 py-2 text-sm leading-5 text-[#B91C1C]"
            >
              {errorMessage}
            </div>
          ) : null}

          <div>
            <AuthLabel>Email</AuthLabel>
            <AuthInput type="email" name="email" autoComplete="email" placeholder="you@company.com" required disabled={loading} />
          </div>

          <AuthPrimaryButton type="submit" disabled={loading}>
            {loading ? "Sending…" : "Send reset link"}
          </AuthPrimaryButton>
        </form>
      )}
    </>
  );
}
