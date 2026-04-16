"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { AuthCenteredLayout } from "@/components/auth/auth-centered-layout";
import { AuthInput, AuthLabel, AuthPrimaryButton } from "@/components/auth/auth-form-ui";
import {
  establishAuthSessionFromCurrentUrl,
  replaceUrlPathOnly,
} from "@/lib/auth/establish-session-from-url";
import { PATH_APP_ENTRY, PATH_AUTH_RESET_PASSWORD } from "@/lib/auth/routes";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

const REDIRECT_TO_SCREENER_MS = 900;

const MIN_PASSWORD_LEN = 8;

export function ResetPasswordClient() {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [updated, setUpdated] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
  const [checked, setChecked] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const formCanSubmit =
    password.length >= MIN_PASSWORD_LEN && confirmPassword.length >= MIN_PASSWORD_LEN && !loading;

  useEffect(() => {
    let cancelled = false;
    const supabase = getSupabaseBrowserClient();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (cancelled) return;
      if (event === "PASSWORD_RECOVERY" || session) {
        setSessionReady(!!session);
      }
      setChecked(true);
    });

    void (async () => {
      const result = await establishAuthSessionFromCurrentUrl();
      if (cancelled) return;

      if (result.status === "established") {
        replaceUrlPathOnly(PATH_AUTH_RESET_PASSWORD);
        setSessionReady(true);
        setChecked(true);
        return;
      }
      if (result.status === "failed") {
        setSessionReady(false);
        setChecked(true);
        return;
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (cancelled) return;
      if (session) setSessionReady(true);
      setChecked(true);
    })();

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!updated) return;
    const id = window.setTimeout(() => {
      window.location.replace(PATH_APP_ENTRY);
    }, REDIRECT_TO_SCREENER_MS);
    return () => window.clearTimeout(id);
  }, [updated]);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrorMessage(null);

    if (password.length < MIN_PASSWORD_LEN) {
      setErrorMessage("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setErrorMessage("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase.auth.updateUser({ password });

      if (error) {
        setErrorMessage(error.message);
        return;
      }

      // Keep the session so the user can land on /screener after redirect (same as post-recovery UX).
      setUpdated(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong. Please try again.";
      setErrorMessage(message);
    } finally {
      setLoading(false);
    }
  }

  if (!checked) {
    return (
      <AuthCenteredLayout title="Reset your password" subtitle="Checking your reset link…">
        <p className="text-sm text-[#71717A]">Loading…</p>
      </AuthCenteredLayout>
    );
  }

  if (!sessionReady) {
    return (
      <AuthCenteredLayout
        title="Link invalid or expired"
        subtitle="Request a new reset link to continue."
      >
        <div
          role="alert"
          className="rounded-[10px] border border-[#FECACA] bg-[#FEF2F2] px-3 py-2 text-sm leading-6 text-[#B91C1C]"
        >
          This reset link may have expired. Please start the process again.
        </div>
        <div className="mt-6 text-center">
          <Link
            href="/forgot-password"
            className="text-sm font-semibold text-[#09090B] underline decoration-[#E4E4E7] underline-offset-4 transition-colors hover:decoration-[#A1A1AA]"
          >
            Back to forgot password
          </Link>
        </div>
      </AuthCenteredLayout>
    );
  }

  if (updated) {
    return (
      <AuthCenteredLayout compact title="You're in" subtitle="Taking you to Finsepa…">
        {null}
      </AuthCenteredLayout>
    );
  }

  return (
    <AuthCenteredLayout title="Set a new password" subtitle="Choose a new password for your account.">
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
          <AuthLabel>New password</AuthLabel>
          <AuthInput
            type="password"
            name="password"
            autoComplete="new-password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              if (errorMessage) setErrorMessage(null);
            }}
            minLength={MIN_PASSWORD_LEN}
            disabled={loading}
          />
        </div>

        <div>
          <AuthLabel>Confirm new password</AuthLabel>
          <AuthInput
            type="password"
            name="confirmPassword"
            autoComplete="new-password"
            placeholder="••••••••"
            value={confirmPassword}
            onChange={(e) => {
              setConfirmPassword(e.target.value);
              if (errorMessage) setErrorMessage(null);
            }}
            minLength={MIN_PASSWORD_LEN}
            disabled={loading}
          />
        </div>

        <AuthPrimaryButton type="submit" disabled={!formCanSubmit}>
          {loading ? "Updating…" : "Update password"}
        </AuthPrimaryButton>
      </form>
    </AuthCenteredLayout>
  );
}
