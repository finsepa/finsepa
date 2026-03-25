"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AuthLogo } from "@/components/auth/auth-logo";
import {
  AuthDivider,
  AuthInput,
  AuthLabel,
  AuthPrimaryButton,
  AuthTitleBlock,
} from "@/components/auth/auth-form-ui";
import { AuthSocialButtons } from "@/components/auth/auth-social-buttons";
import { PATH_APP_ENTRY } from "@/lib/auth/routes";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

export function LoginClient() {
  const router = useRouter();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    console.log("submit started");
    setErrorMessage(null);

    const form = e.currentTarget;
    const fd = new FormData(form);
    const email = String(fd.get("email") ?? "").trim();
    const password = String(fd.get("password") ?? "");

    setLoading(true);
    try {
      const supabase = getSupabaseBrowserClient();
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });

      if (error) {
        console.log("login error", error);
        setErrorMessage(error.message);
        return;
      }

      console.log("login success", data.session?.user?.id ?? data.user?.id);
      router.refresh();
      router.push(PATH_APP_ENTRY);
    } catch (err) {
      console.log("login error", err);
      const message = err instanceof Error ? err.message : "Something went wrong. Please try again.";
      setErrorMessage(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-[380px]">
      <div className="mb-8">
        <AuthLogo href="/" />
      </div>

      <AuthTitleBlock
        title="Welcome back"
        subtitle={
          <>
            Sign in to continue.{" "}
            <Link
              href="/signup"
              className="font-semibold text-[#09090B] underline decoration-[#E4E4E7] underline-offset-4 transition-colors hover:decoration-[#A1A1AA]"
            >
              Create an account
            </Link>
            .
          </>
        }
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
          <AuthLabel>Email</AuthLabel>
          <AuthInput type="email" name="email" autoComplete="email" placeholder="you@company.com" required disabled={loading} />
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
        </div>

        <div className="flex items-center justify-between pt-1">
          <label className="flex items-center gap-2 text-sm text-[#52525B]">
            <input
              type="checkbox"
              name="remember"
              className="h-4 w-4 rounded border-[#D4D4D8] text-[#09090B] focus:ring-[#09090B]/20"
              disabled={loading}
            />
            Remember me
          </label>

          <Link
            href="/forgot-password"
            className="text-sm font-semibold text-[#09090B] underline decoration-[#E4E4E7] underline-offset-4 transition-colors hover:decoration-[#A1A1AA]"
          >
            Forgot password
          </Link>
        </div>

        <div className="pt-2">
          <AuthPrimaryButton type="submit" disabled={loading}>
            {loading ? "Signing in…" : "Log in"}
          </AuthPrimaryButton>
        </div>
      </form>

      <AuthDivider />
      <AuthSocialButtons />

      <p className="mt-8 text-xs leading-5 text-[#A1A1AA]">Social sign-in is a UI placeholder for now.</p>
    </div>
  );
}
