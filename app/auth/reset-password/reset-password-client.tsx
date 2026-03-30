"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AuthLogo } from "@/components/auth/auth-logo";
import { AuthInput, AuthLabel, AuthPrimaryButton, AuthTitleBlock } from "@/components/auth/auth-form-ui";
import { PATH_LOGIN } from "@/lib/auth/routes";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

export function ResetPasswordClient() {
  const router = useRouter();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
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
      router.push(`${PATH_LOGIN}?reset=success`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong. Please try again.";
      setErrorMessage(message);
    } finally {
      setLoading(false);
    }
  }

  if (!checked) {
    return (
      <div className="mx-auto w-full max-w-[380px]">
        <div className="mb-8">
          <AuthLogo href="/" />
        </div>
        <p className="text-sm text-[#52525B]">Loading…</p>
      </div>
    );
  }

  if (!sessionReady) {
    return (
      <div className="mx-auto w-full max-w-[380px]">
        <div className="mb-8">
          <AuthLogo href="/" />
        </div>
        <AuthTitleBlock title="Link invalid or expired" subtitle="Request a new reset link from the login page." />
        <div
          role="alert"
          className="mt-4 rounded-[10px] border border-[#FECACA] bg-[#FEF2F2] px-3 py-2 text-sm leading-5 text-[#B91C1C]"
        >
          This reset link may have expired. Please start the process again.
        </div>
        <div className="mt-6">
          <Link
            href={PATH_LOGIN}
            className="text-sm font-semibold text-[#09090B] underline decoration-[#E4E4E7] underline-offset-4 transition-colors hover:decoration-[#A1A1AA]"
          >
            Back to log in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[380px]">
      <div className="mb-8">
        <AuthLogo href="/" />
      </div>

      <AuthTitleBlock
        title="Choose a new password"
        subtitle="Use a strong password you haven’t used elsewhere."
      />

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
          <AuthLabel>Confirm password</AuthLabel>
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

        <div className="pt-2">
          <AuthPrimaryButton type="submit" disabled={loading}>
            {loading ? "Updating…" : "Update password"}
          </AuthPrimaryButton>
        </div>
      </form>
    </div>
  );
}
