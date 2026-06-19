"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import {
  AuthCheckbox,
  AuthDivider,
  AuthInput,
  AuthLabel,
  AuthPrimaryButton,
  AuthSecondaryButton,
  authAccentLinkClassName,
} from "@/components/auth/auth-form-ui";
import { AuthPasswordInput } from "@/components/auth/auth-password-input";
import { TurnstileField } from "@/components/auth/turnstile-field";
import { getAuthAppOriginForClient } from "@/lib/auth/app-origin";
import { PATH_APP_ENTRY, PATH_AUTH_CALLBACK } from "@/lib/auth/routes";
import { useTurnstileConfig } from "@/lib/auth/use-turnstile-config";
import { friendlySupabaseAuthErrorMessage } from "@/lib/auth/supabase-error-message";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { cn } from "@/lib/utils";

const STORAGE_REMEMBER = "finsepa_remember_me";

const CALLBACK_ERROR_MESSAGES: Record<string, string> = {
  session:
    "Google sign-in could not finish (session expired or was already used). Close other Finsepa tabs, try again from https://app.finsepa.com/login, or use email and password.",
  missing_code: "That sign-in link is incomplete. Open the link from your email again.",
  oauth:
    "Google sign-in was cancelled or blocked. Try again, or use email and password if the problem continues.",
  config: "Authentication isn’t configured correctly. Please try again later.",
};

type Props = {
  resetSuccess?: boolean;
  callbackError?: string | null;
  authNext?: string | null;
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
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LEN = 8;

export function LoginClient({ resetSuccess, callbackError, authNext }: Props) {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [passwordLoginSuccess, setPasswordLoginSuccess] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const { siteKey: turnstileSiteKey, enabled: turnstileEnabled, ready: turnstileConfigReady } =
    useTurnstileConfig();

  const emailNorm = email.trim().toLowerCase();
  const emailReady = emailNorm.length > 0 && EMAIL_RE.test(emailNorm);
  const passwordReady = password.length >= MIN_PASSWORD_LEN;
  const showTurnstile =
    turnstileConfigReady &&
    turnstileEnabled &&
    Boolean(turnstileSiteKey) &&
    emailReady &&
    passwordReady;
  const formCanSubmit =
    emailReady && passwordReady && (!showTurnstile || Boolean(turnstileToken));

  useEffect(() => {
    setTurnstileToken(null);
  }, [emailNorm]);

  useEffect(() => {
    if (!showTurnstile) setTurnstileToken(null);
  }, [showTurnstile]);

  const onTurnstileToken = useCallback((token: string) => setTurnstileToken(token), []);
  const onTurnstileExpire = useCallback(() => setTurnstileToken(null), []);

  const callbackHint = callbackError ? CALLBACK_ERROR_MESSAGES[callbackError] ?? "Something went wrong. Please try again." : null;
  const sessionExpiredHint =
    !callbackHint && authNext ?
      "Your session could not be restored. Sign in again to continue."
    : null;
  const bannerHint = callbackHint ?? sessionExpiredHint;

  useEffect(() => {
    try {
      const r = localStorage.getItem(STORAGE_REMEMBER);
      if (r === "0") setRememberMe(false);
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
      const authOrigin = getAuthAppOriginForClient();
      const redirectTo = `${authOrigin}${PATH_AUTH_CALLBACK}?next=${encodeURIComponent(PATH_APP_ENTRY)}`;
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

      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
        options: turnstileToken ? { captchaToken: turnstileToken } : undefined,
      });

      if (error) {
        const raw = friendlySupabaseAuthErrorMessage(error.message);
        const captchaRelated = /captcha|security check/i.test(raw) || /captcha/i.test(error.message);
        if (captchaRelated && !turnstileEnabled) {
          setErrorMessage(
            "Supabase requires Turnstile, but this app has no site key. Add NEXT_PUBLIC_TURNSTILE_SITE_KEY and TURNSTILE_SECRET_KEY to .env.local (Cloudflare → Turnstile → Finsepa), use the same secret in Supabase → Bot Protection, then restart npm run dev.",
          );
        } else if (captchaRelated && turnstileEnabled && !turnstileToken) {
          setErrorMessage("Complete the Cloudflare security check below before logging in.");
        } else {
          setErrorMessage(raw);
        }
        setTurnstileToken(null);
        return;
      }

      try {
        localStorage.setItem(STORAGE_REMEMBER, rememberMe ? "1" : "0");
      } catch {
        /* ignore */
      }

      setPasswordLoginSuccess(true);
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
    <div className="space-y-4">
      {passwordLoginSuccess ? (
        <div
          role="status"
          className="rounded-[10px] border border-[#BBF7D0] bg-[#F0FDF4] px-3 py-2.5 text-center text-sm font-medium leading-5 text-[#166534] shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
        >
          Logged in successfully. Redirecting to the app…
        </div>
      ) : null}

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

      {bannerHint ? (
        <div
          role="alert"
          className="rounded-[10px] border border-[#FECACA] bg-[#FEF2F2] px-3 py-2 text-sm leading-5 text-[#B91C1C]"
        >
          {bannerHint}
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
          placeholder="Enter your email"
          required
          disabled={loading}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>

      <div>
        <AuthLabel>Password</AuthLabel>
        <AuthPasswordInput
          name="password"
          autoComplete="current-password"
          placeholder="Enter your password"
          required
          disabled={loading}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <div className="mt-6 flex items-center justify-between gap-4">
          <label className="flex cursor-pointer items-center gap-2 select-none">
            <AuthCheckbox
              checked={rememberMe}
              onCheckedChange={setRememberMe}
              disabled={loading}
              aria-label="Remember me on this device"
            />
            <span className="text-[14px] font-normal leading-5 text-[#09090B]">Remember me</span>
          </label>
          <Link
            href="/forgot-password"
            className={cn("shrink-0", authAccentLinkClassName)}
          >
            Forgot password?
          </Link>
        </div>
      </div>

      {showTurnstile ? (
        <TurnstileField
          key={emailNorm}
          siteKey={turnstileSiteKey}
          onToken={onTurnstileToken}
          onExpire={onTurnstileExpire}
        />
      ) : null}

      <div className="!mt-6">
        <AuthPrimaryButton
          type="submit"
          disabled={loading || !formCanSubmit}
        >
          {loading ? "Signing in…" : "Log in"}
        </AuthPrimaryButton>
      </div>
      </form>
    </div>
  );
}
