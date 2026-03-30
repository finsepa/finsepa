"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AuthLogo } from "@/components/auth/auth-logo";
import { PATH_APP_ENTRY, PATH_LOGIN } from "@/lib/auth/routes";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { AuthInput, AuthLabel, AuthPrimaryButton, AuthTitleBlock } from "@/components/auth/auth-form-ui";

export function SignupClient() {
  const router = useRouter();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrorMessage(null);

    const form = e.currentTarget;
    const fd = new FormData(form);
    const firstName = String(fd.get("firstName") ?? "").trim();
    const lastName = String(fd.get("lastName") ?? "").trim();
    const email = String(fd.get("email") ?? "").trim();
    const password = String(fd.get("password") ?? "");
    const confirmPassword = String(fd.get("confirmPassword") ?? "");

    if (password !== confirmPassword) {
      setErrorMessage("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const supabase = getSupabaseBrowserClient();
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            first_name: firstName,
            last_name: lastName,
          },
        },
      });

      if (error) {
        setErrorMessage(error.message);
        return;
      }

      router.refresh();

      if (data.session) {
        router.push(PATH_APP_ENTRY);
        return;
      }

      router.push(PATH_LOGIN);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong. Please try again.";
      setErrorMessage(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-[420px]">
      <div className="mb-8">
        <AuthLogo href="/" />
      </div>

      <AuthTitleBlock
        title="Create your account"
        subtitle={
          <>
            Already have an account?{" "}
            <Link
              href="/login"
              className="font-semibold text-[#09090B] underline decoration-[#E4E4E7] underline-offset-4 transition-colors hover:decoration-[#A1A1AA]"
            >
              Log in
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

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <AuthLabel>First name</AuthLabel>
            <AuthInput name="firstName" autoComplete="given-name" placeholder="Ava" required disabled={loading} />
          </div>
          <div>
            <AuthLabel>Last name</AuthLabel>
            <AuthInput name="lastName" autoComplete="family-name" placeholder="Johnson" required disabled={loading} />
          </div>
        </div>

        <div>
          <AuthLabel>Email</AuthLabel>
          <AuthInput type="email" name="email" autoComplete="email" placeholder="you@company.com" required disabled={loading} />
        </div>

        <div>
          <AuthLabel>Password</AuthLabel>
          <AuthInput
            type="password"
            name="password"
            autoComplete="new-password"
            placeholder="Create a password"
            required
            disabled={loading}
          />
        </div>

        <div>
          <AuthLabel>Confirm password</AuthLabel>
          <AuthInput
            type="password"
            name="confirmPassword"
            autoComplete="new-password"
            placeholder="Repeat your password"
            required
            disabled={loading}
          />
        </div>

        <div className="pt-2">
          <AuthPrimaryButton type="submit" disabled={loading}>
            {loading ? "Creating account…" : "Sign up"}
          </AuthPrimaryButton>
        </div>
      </form>
    </div>
  );
}
