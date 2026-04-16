"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { AuthDivider, AuthInput, AuthLabel, AuthPrimaryButton, AuthSecondaryButton } from "@/components/auth/auth-form-ui";
import { PATH_APP_ENTRY, PATH_AUTH_CALLBACK } from "@/lib/auth/routes";
import { friendlySupabaseAuthErrorMessage } from "@/lib/auth/supabase-error-message";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

const STORAGE_REMEMBER = "finsepa_remember_me";
const STORAGE_SAVED_EMAIL = "finsepa_login_email";

const CALLBACK_ERROR_MESSAGES: Record<string, string> = {
  session: "That sign-in link is invalid or expired. Try resetting your password again.",
  missing_code: "That sign-in link is incomplete. Open the link from your email again.",
  config: "Authentication isn’t configured correctly. Please try again later.",
};

type Props = {
  resetSuccess?: boolean;
  callbackError?: string | null;
  /** Fired after email/password sign-in succeeds, before redirect (shows banner above card). */
  onEmailPasswordSuccess?: () => void;
};

function GoogleMark() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4">
      <path
        fill="#EA4335"
        d="M12 10.2v3.9h5.4c-.2 1.3-1.6 3.8-5.4 3.8-3.2 0-5.9-2.7-5.9-5.9S8.8 6.1 12 6.1c1.8 0 3 .8 3.7 1.4l2.5-2.4C16.8 3.8 14.7 3 12 3 7 3 3 7 3 12s4 9 9 9c5.2 0 8.6-3.7 8.6-8.9 0-.6-.1-1-.1-1.4H12z"
      />
      <path fill="#34A853" d="M3.9 7.3l3.2 2.3C7.9 7.8 9.8 6.1 12 6.1c1.8 0 3 .8 3.7 1.4l2.5-2.4C16.8 3.8 14.7 3 12 3c-3.5 0-6.5 2-8.1 4.3z" opacity=".001" />
    </svg>
  );
}

const REDIRECT_AFTER_LOGIN_MS = 900;

export function LoginClient({ resetSuccess, callbackError, onEmailPasswordSuccess }: Props) {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [email, setEmail] = useState("");

  const callbackHint = callbackError ? CALLBACK_ERROR_MESSAGES[callbackError] ?? "Something went wrong. Please try again." : null;

  useEffect(() => {
    try {
      const r = localStorage.getItem(STORAGE_REMEMBER);
      if (r === "0") setRememberMe(false);
      if (r !== "0") {
        const savedEmail = localStorage.getItem(STORAGE_SAVED_EMAIL);
        if (savedEmail) setEmail(savedEmail);
      }
    } catch {
      /* ignore */
    }
  }, []);

  async function handleGoogle() {
    setErrorMessage(null);
    if (loading) return;
    setLoading(true);
    try {
      try {
        localStorage.setItem(STORAGE_REMEMBER, rememberMe ? "1" : "0");
      } catch {
        /* ignore */
      }
      const supabase = getSupabaseBrowserClient();
      const origin = window.location.origin;
      const redirectTo = `${origin}${PATH_AUTH_CALLBACK}?next=${encodeURIComponent(PATH_APP_ENTRY)}`;
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo },
      });
      if (error) {
        setErrorMessage(friendlySupabaseAuthErrorMessage(error.message));
        setLoading(false);
      }
      // On success, Supabase redirects away; no further action needed here.
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong. Please try again.";
      setErrorMessage(message);
      setLoading(false);
    }
  }

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
        setErrorMessage(friendlySupabaseAuthErrorMessage(error.message));
        return;
      }

      try {
        localStorage.setItem(STORAGE_REMEMBER, rememberMe ? "1" : "0");
        if (rememberMe) {
          localStorage.setItem(STORAGE_SAVED_EMAIL, email);
        } else {
          localStorage.removeItem(STORAGE_SAVED_EMAIL);
        }
      } catch {
        /* ignore */
      }

      onEmailPasswordSuccess?.();
      await new Promise((r) => setTimeout(r, REDIRECT_AFTER_LOGIN_MS));
      // Full navigation avoids Turbopack / dev RSC failures from router.refresh + router.push.
      window.location.replace(PATH_APP_ENTRY);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong. Please try again.";
      setErrorMessage(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit} noValidate>
      <AuthSecondaryButton onClick={handleGoogle} disabled={loading}>
        <GoogleMark />
        {loading ? "Redirecting…" : "Continue with Google"}
      </AuthSecondaryButton>

      <AuthDivider />

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
        <AuthInput
          type="email"
          name="email"
          autoComplete="email"
          placeholder="you@company.com"
          required
          disabled={loading}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
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
        <div className="mt-3 flex items-center justify-between gap-4">
          <label className="flex cursor-pointer items-center gap-2 select-none">
            <input
              type="checkbox"
              name="remember"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              disabled={loading}
              className="h-4 w-4 shrink-0 cursor-pointer rounded-[4px] border border-[#D4D4D8] accent-[#09090B] disabled:cursor-not-allowed disabled:opacity-60"
              aria-label="Remember me on this device"
            />
            <span className="text-sm font-semibold text-[#09090B]">Remember me</span>
          </label>
          <Link
            href="/forgot-password"
            className="shrink-0 text-sm font-semibold text-[#09090B] underline decoration-[#E4E4E7] underline-offset-4 transition-colors hover:decoration-[#A1A1AA]"
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
