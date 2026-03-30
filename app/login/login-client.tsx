"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AuthInput, AuthLabel, AuthPrimaryButton } from "@/components/auth/auth-form-ui";
import { PATH_APP_ENTRY } from "@/lib/auth/routes";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

const CALLBACK_ERROR_MESSAGES: Record<string, string> = {
  session: "That sign-in link is invalid or expired. Try resetting your password again.",
  missing_code: "That sign-in link is incomplete. Open the link from your email again.",
  config: "Authentication isn’t configured correctly. Please try again later.",
};

type Props = {
  resetSuccess?: boolean;
  callbackError?: string | null;
};

export function LoginClient({ resetSuccess, callbackError }: Props) {
  const router = useRouter();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const callbackHint = callbackError ? CALLBACK_ERROR_MESSAGES[callbackError] ?? "Something went wrong. Please try again." : null;

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrorMessage(null);

    const form = e.currentTarget;
    const fd = new FormData(form);
    const email = String(fd.get("email") ?? "").trim();
    const password = String(fd.get("password") ?? "");

    setLoading(true);
    try {
      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase.auth.signInWithPassword({ email, password });

      if (error) {
        setErrorMessage(error.message);
        return;
      }

      router.refresh();
      router.push(PATH_APP_ENTRY);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong. Please try again.";
      setErrorMessage(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit} noValidate>
      {resetSuccess ? (
        <div
          role="status"
          className="rounded-[10px] border border-[#BBF7D0] bg-[#F0FDF4] px-3 py-2 text-sm leading-5 text-[#166534]"
        >
          Your password was updated. You can log in with your new password.
        </div>
      ) : null}

      {callbackHint ? (
        <div
          role="alert"
          className="rounded-[10px] border border-[#FECACA] bg-[#FEF2F2] px-3 py-2 text-sm leading-5 text-[#B91C1C]"
        >
          {callbackHint}
        </div>
      ) : null}

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

      <div>
        <AuthLabel>Password</AuthLabel>
        <AuthInput
          type="password"
          name="password"
          autoComplete="current-password"
          placeholder="••••••••"
          required
          disabled={loading}
        />
        <div className="mt-3 flex justify-end">
          <Link
            href="/forgot-password"
            className="text-sm font-semibold text-[#09090B] underline decoration-[#E4E4E7] underline-offset-4 transition-colors hover:decoration-[#A1A1AA]"
          >
            Forgot password?
          </Link>
        </div>
      </div>

      <AuthPrimaryButton type="submit" disabled={loading}>
        {loading ? "Signing in…" : "Log in"}
      </AuthPrimaryButton>
    </form>
  );
}
