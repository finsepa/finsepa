"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import {
  AuthDivider,
  AuthPrimaryButton,
  AuthSecondaryButton,
  authEntryCtaClassName,
  authAccentLinkClassName,
} from "@/components/auth/auth-form-ui";
import {
  AuthFloatingInput,
  AuthFloatingPasswordInput,
} from "@/components/auth/auth-floating-field";
import { PATH_APP_ENTRY } from "@/lib/auth/routes";
import { startGoogleOAuth } from "@/lib/auth/start-google-oauth";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { cn } from "@/lib/utils";
import { SpinnerLabel } from "@/components/ui/spinner";

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
  signedOut?: boolean;
};

type EmailLookupStatus =
  | "idle"
  | "checking"
  | "found"
  | "not_found"
  | "google_only"
  | "unavailable";

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
const EMAIL_LOOKUP_DEBOUNCE_MS = 400;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LEN = 8;

export function LoginClient({ resetSuccess, callbackError, authNext, signedOut }: Props) {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [passwordLoginSuccess, setPasswordLoginSuccess] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [emailLookup, setEmailLookup] = useState<EmailLookupStatus>("idle");
  const [emailHint, setEmailHint] = useState<string | null>(null);

  const emailNorm = email.trim().toLowerCase();
  const emailReady = emailNorm.length > 0 && EMAIL_RE.test(emailNorm);
  const passwordReady = password.length >= MIN_PASSWORD_LEN;
  const showPasswordStep = emailLookup === "found" || emailLookup === "unavailable";
  const formCanSubmit = emailReady && showPasswordStep && passwordReady;

  const callbackHint = callbackError ? CALLBACK_ERROR_MESSAGES[callbackError] ?? "Something went wrong. Please try again." : null;
  const sessionExpiredHint =
    !callbackHint && !signedOut && authNext ?
      "Please sign in to continue."
    : null;
  const bannerHint = callbackHint ?? sessionExpiredHint;

  useEffect(() => {
    if (!emailReady) {
      setEmailLookup("idle");
      setEmailHint(null);
      setPassword("");
      return;
    }

    const emailAtRequest = emailNorm;
    const controller = new AbortController();
    setEmailLookup("checking");
    setEmailHint(null);
    setPassword("");

    const timer = window.setTimeout(async () => {
      try {
        const res = await fetch("/api/auth/check-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: emailAtRequest }),
          signal: controller.signal,
        });
        const data = (await res.json().catch(() => ({}))) as {
          exists?: boolean;
          googleOnly?: boolean;
          message?: string;
          error?: string;
        };

        if (controller.signal.aborted) return;

        if (res.status === 429) {
          setEmailLookup("idle");
          setEmailHint(data.message?.trim() || "Too many checks. Wait a moment and try again.");
          return;
        }

        if (!res.ok) {
          // Degrade: still allow password entry if lookup is down.
          setEmailLookup("unavailable");
          setEmailHint(null);
          return;
        }

        if (data.exists && data.googleOnly) {
          setEmailLookup("google_only");
          setEmailHint("This account uses Google sign-in. Continue with Google instead.");
          return;
        }

        if (data.exists) {
          setEmailLookup("found");
          setEmailHint(null);
          return;
        }

        setEmailLookup("not_found");
        setEmailHint("No account found for this email.");
      } catch (err) {
        if (controller.signal.aborted) return;
        if (err instanceof DOMException && err.name === "AbortError") return;
        setEmailLookup("unavailable");
        setEmailHint(null);
      }
    }, EMAIL_LOOKUP_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [emailNorm, emailReady]);

  function persistRememberMe() {
    try {
      localStorage.setItem(STORAGE_REMEMBER, "1");
    } catch {
      /* ignore */
    }
  }

  async function handleGoogle() {
    setErrorMessage(null);
    if (loading) return;
    setLoading(true);
    try {
      persistRememberMe();
      const supabase = getSupabaseBrowserClient();
      await startGoogleOAuth(supabase, { next: PATH_APP_ENTRY, intent: "login" });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong. Please try again.";
      setErrorMessage(message);
      setLoading(false);
    }
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrorMessage(null);
    if (!showPasswordStep) return;

    const form = e.currentTarget;
    const fd = new FormData(form);
    const email = String(fd.get("email") ?? "").trim();
    const password = String(fd.get("password") ?? "");

    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, next: authNext }),
      });

      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        message?: string;
        redirectTo?: string;
      };

      if (!res.ok) {
        setErrorMessage(data.message?.trim() || "Invalid email or password.");
        return;
      }

      persistRememberMe();

      setPasswordLoginSuccess(true);
      await new Promise((r) => setTimeout(r, REDIRECT_AFTER_LOGIN_MS));
      // Full navigation avoids Turbopack / dev RSC failures from router.refresh + router.push.
      window.location.replace(
        typeof data.redirectTo === "string" && data.redirectTo.startsWith("/")
          ? data.redirectTo
          : PATH_APP_ENTRY,
      );
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

      <AuthSecondaryButton
        className={authEntryCtaClassName}
        onClick={handleGoogle}
        disabled={loading}
      >
        <GoogleMark />
        {loading ? <SpinnerLabel>Redirecting…</SpinnerLabel> : "Continue with Google"}
      </AuthSecondaryButton>

      <form className="space-y-4" onSubmit={handleSubmit} noValidate>
      <AuthDivider />

      {resetSuccess ? (
        <div
          role="status"
          className="rounded-[10px] border border-[#BBF7D0] bg-[#F0FDF4] px-3 py-2 text-sm leading-5 text-[#166534]"
        >
          Your password was updated. You can log in with your new password.
        </div>
      ) : null}

      {signedOut ? (
        <div
          role="status"
          className="rounded-[10px] border border-[#E4E4E7] bg-[#FAFAFA] px-3 py-2 text-sm leading-5 text-[#52525B]"
        >
          You&apos;ve been logged out.
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
        <AuthFloatingInput
          type="email"
          name="email"
          label="Email"
          autoComplete="email"
          required
          disabled={loading}
          value={email}
          trailingLoading={emailLookup === "checking"}
          onChange={(e) => {
            setEmail(e.target.value);
            setErrorMessage(null);
          }}
        />
        {emailHint ? (
          <p
            role="status"
            className={cn(
              "mt-1.5 text-sm leading-5",
              emailLookup === "not_found" || emailLookup === "google_only"
                ? "text-[#B91C1C]"
                : "text-[#52525B]",
            )}
          >
            {emailHint}
          </p>
        ) : null}
      </div>

      {showPasswordStep ? (
        <div>
          <AuthFloatingPasswordInput
            name="password"
            label="Password"
            autoComplete="current-password"
            required
            disabled={loading}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
      ) : null}

      <div className="!mt-6 space-y-3">
        <AuthPrimaryButton
          type="submit"
          className={authEntryCtaClassName}
          disabled={loading || !formCanSubmit}
        >
          {loading ? <SpinnerLabel>Signing in…</SpinnerLabel> : "Log in"}
        </AuthPrimaryButton>
        <div className="text-center">
          <Link href="/forgot-password" className={cn(authAccentLinkClassName)}>
            Forgot password?
          </Link>
        </div>
      </div>
      </form>
    </div>
  );
}
