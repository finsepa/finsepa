"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { AuthCenteredLayout } from "@/components/auth/auth-centered-layout";
import { AuthLabel, AuthPrimaryButton } from "@/components/auth/auth-form-ui";
import { AuthPasswordInput } from "@/components/auth/auth-password-input";
import {
  establishAuthSessionFromCurrentUrl,
  replaceUrlPathOnly,
} from "@/lib/auth/establish-session-from-url";
import {
  parseAuthCallbackParams,
  urlHasAuthCallbackParams,
} from "@/lib/auth/parse-auth-callback-url";
import { PATH_APP_ENTRY, PATH_AUTH_RESET_PASSWORD } from "@/lib/auth/routes";
import { Spinner, SpinnerLabel } from "@/components/ui/spinner";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

const REDIRECT_TO_SCREENER_MS = 900;
const MIN_PASSWORD_LEN = 8;

function recoveryLinkLooksValid(): boolean {
  if (typeof window === "undefined") return false;
  if (!urlHasAuthCallbackParams(window.location.href)) return false;
  const params = parseAuthCallbackParams(window.location.href);
  return params.type === "recovery";
}

type ResetPasswordClientProps = {
  hasRecoveryToken?: boolean;
};

export function ResetPasswordClient({ hasRecoveryToken = false }: ResetPasswordClientProps) {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [updated, setUpdated] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
  const [verifyDone, setVerifyDone] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const formCanSubmit =
    sessionReady &&
    password.length >= MIN_PASSWORD_LEN &&
    confirmPassword.length >= MIN_PASSWORD_LEN &&
    !loading;

  const isVerifying = !verifyDone;
  const expectsRecoveryLink = hasRecoveryToken || recoveryLinkLooksValid();

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const supabase = getSupabaseBrowserClient();
      const result = await establishAuthSessionFromCurrentUrl();
      if (cancelled) return;

      if (result.status === "established") {
        replaceUrlPathOnly(PATH_AUTH_RESET_PASSWORD);
        setSessionReady(true);
        setVerifyDone(true);
        return;
      }

      if (result.status === "failed") {
        setSessionReady(false);
        setVerifyDone(true);
        return;
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (cancelled) return;
      setSessionReady(!!session);
      setVerifyDone(true);
    })();

    return () => {
      cancelled = true;
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

    if (!sessionReady) return;

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

      setUpdated(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong. Please try again.";
      setErrorMessage(message);
    } finally {
      setLoading(false);
    }
  }

  if (updated) {
    return (
      <AuthCenteredLayout split={false} compact title="You're in" subtitle="Taking you to Finsepa…">
        {null}
      </AuthCenteredLayout>
    );
  }

  if (verifyDone && !sessionReady && expectsRecoveryLink) {
    return (
      <AuthCenteredLayout
        split={false}
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

  return (
    <AuthCenteredLayout split={false} title="Set a new password" subtitle="Choose a new password for your account.">
      <form className="space-y-4" onSubmit={handleSubmit} noValidate>
        {isVerifying ? (
          <div className="flex justify-center py-1" role="status" aria-label="Confirming your reset link">
            <Spinner className="size-6 text-[#09090B]" />
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
          <AuthLabel>New password</AuthLabel>
          <AuthPasswordInput
            name="password"
            autoComplete="new-password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              if (errorMessage) setErrorMessage(null);
            }}
            minLength={MIN_PASSWORD_LEN}
            disabled={loading || !sessionReady}
          />
        </div>

        <div>
          <AuthLabel>Confirm new password</AuthLabel>
          <AuthPasswordInput
            name="confirmPassword"
            autoComplete="new-password"
            placeholder="••••••••"
            value={confirmPassword}
            onChange={(e) => {
              setConfirmPassword(e.target.value);
              if (errorMessage) setErrorMessage(null);
            }}
            minLength={MIN_PASSWORD_LEN}
            disabled={loading || !sessionReady}
          />
        </div>

        <AuthPrimaryButton type="submit" disabled={!formCanSubmit}>
          {loading ? <SpinnerLabel>Updating…</SpinnerLabel> : "Update password"}
        </AuthPrimaryButton>
      </form>
    </AuthCenteredLayout>
  );
}
