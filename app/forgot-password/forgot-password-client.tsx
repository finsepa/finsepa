"use client";

import { useMemo, useState, type FormEvent } from "react";
import {
  AuthPrimaryButton,
  authAlertBannerClassName,
  authEntryCtaClassName,
  authSuccessBannerClassName,
} from "@/components/auth/auth-form-ui";
import { AuthFloatingInput } from "@/components/auth/auth-floating-field";
import { useAuthPreCardBanner } from "@/components/auth/auth-pre-card-banner";
import { SpinnerLabel } from "@/components/ui/spinner";
import { requestPasswordResetEmail } from "@/lib/auth/request-password-reset";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function ForgotPasswordClient() {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [email, setEmail] = useState("");

  const emailReady = email.trim().length > 0 && EMAIL_RE.test(email.trim());

  const preCardBanner = useMemo(() => {
    if (sent) {
      return (
        <div role="status" className={`${authSuccessBannerClassName} py-3 leading-6`}>
          Check your email for reset instructions. If you don&apos;t see it, look in spam or try
          again in a few minutes.
        </div>
      );
    }
    if (errorMessage) {
      return (
        <div role="alert" className={authAlertBannerClassName}>
          {errorMessage}
        </div>
      );
    }
    return null;
  }, [sent, errorMessage]);

  useAuthPreCardBanner(preCardBanner);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrorMessage(null);

    const form = e.currentTarget;
    const fd = new FormData(form);
    const emailValue = String(fd.get("email") ?? "").trim();

    setLoading(true);
    try {
      const result = await requestPasswordResetEmail(emailValue);
      if (!result.ok) {
        setErrorMessage(result.message);
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

  if (sent) {
    return (
      <p className="text-center text-sm leading-5 text-fg-muted">
        You can close this page or return to log in when you&apos;re ready.
      </p>
    );
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit} noValidate>
      <AuthFloatingInput
        type="email"
        name="email"
        label="Email"
        autoComplete="email"
        required
        disabled={loading}
        value={email}
        onChange={(e) => {
          setEmail(e.target.value);
          setErrorMessage(null);
        }}
      />

      <AuthPrimaryButton
        type="submit"
        className={authEntryCtaClassName}
        disabled={loading || !emailReady}
      >
        {loading ? <SpinnerLabel>Sending…</SpinnerLabel> : "Send reset link"}
      </AuthPrimaryButton>
    </form>
  );
}
