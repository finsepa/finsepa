"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AuthCenteredLayout } from "@/components/auth/auth-centered-layout";
import { AuthInput, AuthLabel, AuthPrimaryButton } from "@/components/auth/auth-form-ui";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

export function ResetPasswordClient() {
  const router = useRouter();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [updated, setUpdated] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();

    function syncSession() {
      void supabase.auth.getSession().then(({ data: { session } }) => {
        if (session) setSessionReady(true);
        setChecked(true);
      });
    }

    syncSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || session) {
        setSessionReady(!!session);
      }
      setChecked(true);
    });

    return () => subscription.unsubscribe();
  }, []);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrorMessage(null);

    const form = e.currentTarget;
    const fd = new FormData(form);
    const password = String(fd.get("password") ?? "");
    const confirmPassword = String(fd.get("confirmPassword") ?? "");

    if (password.length < 8) {
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

      await supabase.auth.signOut();
      router.refresh();
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
      <AuthCenteredLayout
        title="Password updated"
        subtitle="Your password has been updated successfully. You can log in with your new password."
      >
        <Link href="/login">
          <AuthPrimaryButton type="button">Log In</AuthPrimaryButton>
        </Link>
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
            required
            minLength={8}
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
            required
            minLength={8}
            disabled={loading}
          />
        </div>

        <AuthPrimaryButton type="submit" disabled={loading}>
          {loading ? "Updating…" : "Update password"}
        </AuthPrimaryButton>
      </form>
    </AuthCenteredLayout>
  );
}
