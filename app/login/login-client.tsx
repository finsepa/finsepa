"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  AuthDivider,
  AuthPrimaryButton,
  AuthSecondaryButton,
  authEntryCtaClassName,
  authAlertBannerClassName,
  authSuccessBannerClassName,
} from "@/components/auth/auth-form-ui";
import {
  AuthFloatingInput,
  AuthFloatingPasswordInput,
} from "@/components/auth/auth-floating-field";
import { useAuthPreCardBanner } from "@/components/auth/auth-pre-card-banner";
import { PATH_APP_ENTRY } from "@/lib/auth/routes";
import { startGoogleOAuth } from "@/lib/auth/start-google-oauth";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { Spinner, SpinnerLabel } from "@/components/ui/spinner";

const STORAGE_REMEMBER = "finsepa_remember_me";

type Props = {
  resetSuccess?: boolean;
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
const LOGIN_FETCH_TIMEOUT_MS = 25_000;
/** Cap session resume so a hung Auth fetch cannot leave the CTA stuck on “Signing you in…”. */
const RESUME_SESSION_BUDGET_MS = 8_000;
const RESUME_LOOP_KEY = "finsepa_login_resume_loop";
const RESUME_LOOP_MAX = 2;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LEN = 8;

function safeNextPath(raw: string | null | undefined): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return PATH_APP_ENTRY;
  return raw;
}

function readResumeLoopCount(): number {
  try {
    return Math.max(0, Number(sessionStorage.getItem(RESUME_LOOP_KEY) || "0") || 0);
  } catch {
    return 0;
  }
}

function writeResumeLoopCount(n: number) {
  try {
    if (n <= 0) sessionStorage.removeItem(RESUME_LOOP_KEY);
    else sessionStorage.setItem(RESUME_LOOP_KEY, String(n));
  } catch {
    /* private mode */
  }
}

export function LoginClient({ resetSuccess, authNext }: Props) {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordLoginSuccess, setPasswordLoginSuccess] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [resumingSession, setResumingSession] = useState(true);

  const busy = googleLoading || passwordLoading || resumingSession;
  const formLocked = busy || passwordLoginSuccess;
  const emailNorm = email.trim().toLowerCase();
  const emailReady = emailNorm.length > 0 && EMAIL_RE.test(emailNorm);
  const passwordReady = password.length >= MIN_PASSWORD_LEN;
  const formCanSubmit = emailReady && passwordReady;

  // If auth cookies survived a tab close but middleware briefly failed, resume without re-login.
  useEffect(() => {
    let cancelled = false;

    const finish = () => {
      if (!cancelled) setResumingSession(false);
    };

    const budgetId = window.setTimeout(finish, RESUME_SESSION_BUDGET_MS);

    (async () => {
      try {
        const supabase = getSupabaseBrowserClient();
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (cancelled) return;

        if (!session) {
          writeResumeLoopCount(0);
          finish();
          return;
        }

        // Validate with Auth — a stale local session would bounce through middleware → login forever.
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();
        if (cancelled) return;

        if (!user || userError) {
          writeResumeLoopCount(0);
          try {
            await supabase.auth.signOut({ scope: "local" });
          } catch {
            /* form will allow re-login */
          }
          finish();
          return;
        }

        const loops = readResumeLoopCount() + 1;
        if (loops > RESUME_LOOP_MAX) {
          // Protected redirect rejected the session cookie path repeatedly — stop looping.
          writeResumeLoopCount(0);
          try {
            await supabase.auth.signOut({ scope: "local" });
          } catch {
            /* ignore */
          }
          finish();
          return;
        }
        writeResumeLoopCount(loops);

        window.location.replace(safeNextPath(authNext));
        // Keep spinner until the document unloads.
      } catch {
        finish();
      } finally {
        window.clearTimeout(budgetId);
      }
    })();

    return () => {
      cancelled = true;
      window.clearTimeout(budgetId);
    };
  }, [authNext]);

  const preCardBanner = useMemo(() => {
    if (errorMessage) {
      return (
        <div role="alert" className={authAlertBannerClassName}>
          {errorMessage}
        </div>
      );
    }
    if (passwordLoginSuccess) {
      return (
        <div role="status" className={authSuccessBannerClassName}>
          Signed in successfully.
        </div>
      );
    }
    if (resetSuccess) {
      return (
        <div role="status" className={authSuccessBannerClassName}>
          Your password was updated. You can log in with your new password.
        </div>
      );
    }
    return null;
  }, [errorMessage, passwordLoginSuccess, resetSuccess]);

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
    if (formLocked) return;
    setGoogleLoading(true);
    try {
      persistRememberMe();
      const supabase = getSupabaseBrowserClient();
      await startGoogleOAuth(supabase, { next: PATH_APP_ENTRY, intent: "login" });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong. Please try again.";
      setErrorMessage(message);
      setGoogleLoading(false);
    }
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrorMessage(null);
    if (!formCanSubmit || formLocked) return;

    const form = e.currentTarget;
    const fd = new FormData(form);
    const emailValue = String(fd.get("email") ?? "").trim();
    const passwordValue = String(fd.get("password") ?? "");

    setPasswordLoading(true);
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), LOGIN_FETCH_TIMEOUT_MS);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: emailValue, password: passwordValue, next: authNext }),
        signal: controller.signal,
        credentials: "same-origin",
      });

      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        message?: string;
        redirectTo?: string;
      };

      if (!res.ok) {
        setErrorMessage(data.message?.trim() || "Invalid email or password.");
        setPasswordLoading(false);
        return;
      }

      persistRememberMe();

      setPasswordLoginSuccess(true);
      writeResumeLoopCount(0);
      await new Promise((r) => setTimeout(r, REDIRECT_AFTER_LOGIN_MS));
      // Full navigation avoids Turbopack / dev RSC failures from router.refresh + router.push.
      window.location.replace(
        typeof data.redirectTo === "string" && data.redirectTo.startsWith("/")
          ? data.redirectTo
          : PATH_APP_ENTRY,
      );
      // Keep spinner + blue CTA through redirect; do not clear loading.
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        setErrorMessage("Sign-in timed out. Check your connection and try again.");
      } else {
        const message = err instanceof Error ? err.message : "Something went wrong. Please try again.";
        setErrorMessage(message);
      }
      setPasswordLoading(false);
    } finally {
      window.clearTimeout(timeoutId);
    }
  }

  // Session check runs only in the browser; keep SSR + first client paint identical
  // (spinner only — no text) so HMR/stale RSC HTML cannot hydrate-mismatch labels.
  if (resumingSession) {
    return (
      <div className="flex justify-center py-6" role="status" aria-label="Checking session">
        <Spinner className="size-5 text-fg" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <AuthSecondaryButton
        className={authEntryCtaClassName}
        onClick={handleGoogle}
        disabled={formLocked}
      >
        <GoogleMark />
        {googleLoading ? <SpinnerLabel>Redirecting…</SpinnerLabel> : "Continue with Google"}
      </AuthSecondaryButton>

      <form className="space-y-4" onSubmit={handleSubmit} noValidate>
        <AuthDivider />

        <AuthFloatingInput
          type="email"
          name="email"
          label="Email"
          autoComplete="email"
          required
          disabled={formLocked}
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            setErrorMessage(null);
          }}
        />

        <AuthFloatingPasswordInput
          name="password"
          label="Password"
          autoComplete="current-password"
          required
          disabled={formLocked}
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            setErrorMessage(null);
          }}
        />

        <div className="!mt-6">
          <AuthPrimaryButton
            type="submit"
            className={authEntryCtaClassName}
            disabled={formLocked || !formCanSubmit}
          >
            {passwordLoading ? <SpinnerLabel>Signing in…</SpinnerLabel> : "Log in"}
          </AuthPrimaryButton>
        </div>
      </form>
    </div>
  );
}
