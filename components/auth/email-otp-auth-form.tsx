"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";

import {
  AuthDivider,
  AuthPrimaryButton,
  AuthSecondaryButton,
  authEntryCtaClassName,
  authAlertBannerClassName,
  authSuccessBannerClassName,
  authWarningBannerClassName,
} from "@/components/auth/auth-form-ui";
import { AuthFloatingInput } from "@/components/auth/auth-floating-field";
import { AuthOtpCodeInput } from "@/components/auth/auth-otp-code-input";
import { useAuthCardHeader } from "@/components/auth/auth-card-header";
import { useAuthPreCardBanner } from "@/components/auth/auth-pre-card-banner";
import { Spinner, SpinnerLabel } from "@/components/ui/spinner";
import { PATH_APP_ENTRY } from "@/lib/auth/routes";
import { startGoogleOAuth } from "@/lib/auth/start-google-oauth";
import { ChevronLeft, Mail } from "@/lib/icons";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const OTP_RE = /^\d{6}$/;
const REDIRECT_AFTER_LOGIN_MS = 900;
const FETCH_TIMEOUT_MS = 25_000;
const STORAGE_REMEMBER = "finsepa_remember_me";

function GoogleMark() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4">
      <path
        fill="#EA4335"
        d="M12 10.2v3.9h5.4c-.2 1.3-1.6 3.8-5.4 3.8-3.2 0-5.9-2.7-5.9-5.9S8.8 6.1 12 6.1c1.8 0 3 .8 3.7 1.4l2.5-2.4C16.8 3.8 14.7 3 12 3 7 3 3 7 3 12s4 9 9 9c5.2 0 8.6-3.7 8.6-8.9 0-.6-.1-1-.1-1.4H12z"
      />
    </svg>
  );
}

function safeNextPath(raw: string | null | undefined): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return PATH_APP_ENTRY;
  return raw;
}

type Step = "email" | "code";

export function EmailOtpAuthForm({
  intent,
  authNext,
  resetSuccess,
  signupPaused,
}: {
  intent: "login" | "signup";
  authNext?: string | null;
  /** Login-only: after password reset (legacy). */
  resetSuccess?: boolean;
  /** Signup page when AUTH_SIGNUP_DISABLED is on. */
  signupPaused?: boolean;
}) {
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [loginSuccess, setLoginSuccess] = useState(false);
  const [cooldownSec, setCooldownSec] = useState(0);

  const busy = googleLoading || sending || verifying || loginSuccess;
  const emailNorm = email.trim().toLowerCase();
  const emailReady = emailNorm.length > 0 && EMAIL_RE.test(emailNorm);
  const codeReady = OTP_RE.test(code.trim());

  useEffect(() => {
    if (cooldownSec <= 0) return;
    const id = window.setTimeout(() => setCooldownSec((s) => Math.max(0, s - 1)), 1000);
    return () => window.clearTimeout(id);
  }, [cooldownSec]);

  function goBackToEmail() {
    setStep("email");
    setCode("");
    setErrorMessage(null);
    setInfoMessage(null);
  }

  const cardHeader = useMemo(() => {
    if (step !== "code") return null;
    return {
      title: "Check your email",
      brand: (
        <div
          aria-hidden
          className="flex size-[52px] items-center justify-center rounded-full bg-accent text-white shadow-[0_0_0_4px_rgba(54,74,255,0.18)]"
        >
          <Mail className="size-6" strokeWidth={2} />
        </div>
      ),
      subtitle: (
        <>
          We sent a 6-digit code to {emailNorm}
        </>
      ),
      leading: (
        <button
          type="button"
          aria-label="Back"
          className="-ml-1 inline-flex size-9 items-center justify-center rounded-lg text-fg-muted transition-colors hover:bg-surface-muted hover:text-fg disabled:opacity-50"
          disabled={busy}
          onClick={goBackToEmail}
        >
          <ChevronLeft className="size-5" />
        </button>
      ),
    };
  }, [busy, emailNorm, step]);

  useAuthCardHeader(cardHeader);

  const preCardBanner = useMemo(() => {
    if (errorMessage) {
      return (
        <div role="alert" className={authAlertBannerClassName}>
          {errorMessage}
        </div>
      );
    }
    if (loginSuccess) {
      return (
        <div role="status" className={authSuccessBannerClassName}>
          Signed in successfully.
        </div>
      );
    }
    // Code step uses the card description instead of a green “sent” banner.
    if (infoMessage && step !== "code") {
      return (
        <div role="status" className={authSuccessBannerClassName}>
          {infoMessage}
        </div>
      );
    }
    if (infoMessage && step === "code") {
      // Resend confirmation only (initial send is the subtitle).
      if (infoMessage.startsWith("New code")) {
        return (
          <div role="status" className={authSuccessBannerClassName}>
            {infoMessage}
          </div>
        );
      }
    }
    if (resetSuccess && intent === "login" && step === "email") {
      return (
        <div role="status" className={authSuccessBannerClassName}>
          Your password was updated. Sign in with an email code.
        </div>
      );
    }
    if (signupPaused && intent === "signup" && step === "email") {
      return (
        <div role="status" className={authWarningBannerClassName}>
          New sign-ups are temporarily paused while we block automated abuse. Existing users can still
          log in with an email code.
        </div>
      );
    }
    return null;
  }, [errorMessage, infoMessage, intent, loginSuccess, resetSuccess, signupPaused, step]);

  useAuthPreCardBanner(preCardBanner);

  function persistRememberMe() {
    try {
      localStorage.setItem(STORAGE_REMEMBER, "1");
    } catch {
      /* ignore */
    }
  }

  async function handleGoogle() {
    setErrorMessage(null);
    if (busy) return;
    setGoogleLoading(true);
    try {
      persistRememberMe();
      const supabase = getSupabaseBrowserClient();
      await startGoogleOAuth(supabase, {
        next: safeNextPath(authNext),
        intent,
      });
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      setGoogleLoading(false);
    }
  }

  async function sendCode(opts?: { resend?: boolean }) {
    setErrorMessage(null);
    setInfoMessage(null);
    if (!emailReady || busy) return;
    if (opts?.resend && cooldownSec > 0) return;

    setSending(true);
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const res = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: emailNorm }),
        signal: controller.signal,
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        message?: string;
        error?: string;
        cooldownSec?: number;
        retryAfterSec?: number;
      };

      if (res.status === 400 && data.error === "google_only") {
        setErrorMessage(data.message?.trim() || "This account uses Google sign-in. Continue with Google instead.");
        return;
      }
      if (!res.ok) {
        if (typeof data.retryAfterSec === "number" && data.retryAfterSec > 0) {
          setCooldownSec(data.retryAfterSec);
        }
        setErrorMessage(data.message?.trim() || "Could not send a code. Try again.");
        return;
      }

      const cool =
        typeof data.cooldownSec === "number" && data.cooldownSec > 0 ? data.cooldownSec : 60;
      setCooldownSec(cool);
      setStep("code");
      setCode("");
      if (opts?.resend) {
        setInfoMessage(`New code sent to ${emailNorm}.`);
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        setErrorMessage("Request timed out. Check your connection and try again.");
      } else {
        setErrorMessage(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      }
    } finally {
      window.clearTimeout(timeoutId);
      setSending(false);
    }
  }

  async function handleEmailSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    await sendCode();
  }

  async function handleCodeSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrorMessage(null);
    setInfoMessage(null);
    if (!emailReady || !codeReady || busy) return;

    const token = code.trim();
    setVerifying(true);
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const res = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: emailNorm, token, next: authNext }),
        credentials: "same-origin",
        signal: controller.signal,
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        message?: string;
        redirectTo?: string;
        retryAfterSec?: number;
      };

      if (!res.ok) {
        if (typeof data.retryAfterSec === "number" && data.retryAfterSec > 0) {
          setCooldownSec(data.retryAfterSec);
        }
        setErrorMessage(data.message?.trim() || "That code is invalid or expired. Try again.");
        setVerifying(false);
        return;
      }

      persistRememberMe();
      setLoginSuccess(true);
      await new Promise((r) => setTimeout(r, REDIRECT_AFTER_LOGIN_MS));
      window.location.replace(
        typeof data.redirectTo === "string" && data.redirectTo.startsWith("/")
          ? data.redirectTo
          : PATH_APP_ENTRY,
      );
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        setErrorMessage("Sign-in timed out. Check your connection and try again.");
      } else {
        setErrorMessage(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      }
      setVerifying(false);
    } finally {
      window.clearTimeout(timeoutId);
    }
  }

  if (step === "code") {
    return (
      <form className="space-y-4" onSubmit={(e) => void handleCodeSubmit(e)} noValidate>
        <AuthOtpCodeInput
          value={code}
          disabled={busy}
          onChange={(next) => {
            setCode(next);
            setErrorMessage(null);
            setInfoMessage(null);
          }}
        />
        <div className="!mt-6 space-y-3">
          <AuthPrimaryButton
            type="submit"
            className={authEntryCtaClassName}
            disabled={busy || !codeReady}
          >
            {verifying ? <Spinner className="size-4 text-white" /> : "Continue"}
          </AuthPrimaryButton>
          <div className="flex flex-col items-center gap-2 text-sm">
            <button
              type="button"
              className="text-fg-muted transition-colors hover:text-fg disabled:opacity-50"
              disabled={busy || cooldownSec > 0 || sending}
              onClick={() => void sendCode({ resend: true })}
            >
              {cooldownSec > 0 ? `Resend code in ${cooldownSec}s` : sending ? "Sending…" : "Resend code"}
            </button>
          </div>
        </div>
      </form>
    );
  }

  return (
    <div className="space-y-4">
      <form className="space-y-4" onSubmit={(e) => void handleEmailSubmit(e)} noValidate>
        <AuthFloatingInput
          type="email"
          name="email"
          label="Email"
          autoComplete="email"
          required
          disabled={busy}
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            setErrorMessage(null);
            setInfoMessage(null);
          }}
        />
        <div className="!mt-6">
          <AuthPrimaryButton
            type="submit"
            className={authEntryCtaClassName}
            disabled={busy || !emailReady}
          >
            {sending ? <Spinner className="size-4 text-white" /> : "Continue"}
          </AuthPrimaryButton>
        </div>
      </form>

      <AuthDivider />
      <AuthSecondaryButton
        className={authEntryCtaClassName}
        onClick={() => void handleGoogle()}
        disabled={busy}
      >
        <GoogleMark />
        {googleLoading ? <SpinnerLabel>Redirecting…</SpinnerLabel> : "Continue with Google"}
      </AuthSecondaryButton>
    </div>
  );
}
