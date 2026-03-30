"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { AuthInput, AuthLabel, AuthPrimaryButton } from "@/components/auth/auth-form-ui";

export function SignupClient() {
  const router = useRouter();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDuplicateEmail, setIsDuplicateEmail] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrorMessage(null);
    setIsDuplicateEmail(false);
    if (loading) return;

    const form = e.currentTarget;
    const fd = new FormData(form);
    const firstName = String(fd.get("firstName") ?? "").trim();
    const lastName = String(fd.get("lastName") ?? "").trim();
    const email = String(fd.get("email") ?? "")
      .trim()
      .toLowerCase();
    const password = String(fd.get("password") ?? "");

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

      const looksLikeDuplicate =
        !!error &&
        (error.status === 400 ||
          error.status === 409 ||
          error.status === 422 ||
          /already registered|already exists|user exists|email.*registered/i.test(error.message));

      // Supabase can also return a user object with no identities when the email is already registered.
      const duplicateByIdentity = !!data?.user && Array.isArray(data.user.identities) && data.user.identities.length === 0;

      if (looksLikeDuplicate || duplicateByIdentity) {
        setIsDuplicateEmail(true);
        setErrorMessage("An account with this email already exists.");
        // Clear password field to encourage a safe re-entry.
        const passwordInput = form.querySelector<HTMLInputElement>('input[name="password"]');
        if (passwordInput) passwordInput.value = "";
        return;
      }

      if (error) {
        setErrorMessage(error.message);
        return;
      }

      router.refresh();

      // Do not auto-login after signup. Always show email confirmation screen first.
      if (data.session) {
        await supabase.auth.signOut();
      }

      const emailParam = encodeURIComponent(email);
      router.push(`/check-email?email=${emailParam}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong. Please try again.";
      setErrorMessage(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit} noValidate>
      {errorMessage ? (
        <div
          role="alert"
          className="rounded-[10px] border border-[#FECACA] bg-[#FEF2F2] px-3 py-2 text-sm leading-5 text-[#B91C1C]"
        >
          <div className="font-medium">{errorMessage}</div>
          {isDuplicateEmail ? (
            <div className="mt-1 text-sm leading-5 text-[#B91C1C]">
              Try logging in or resetting your password.{" "}
              <span className="ml-1 inline-flex gap-3">
                <Link
                  href="/login"
                  className="font-semibold underline decoration-[#FECACA] underline-offset-4 transition-colors hover:decoration-[#FCA5A5]"
                >
                  Log in
                </Link>
                <Link
                  href="/forgot-password"
                  className="font-semibold underline decoration-[#FECACA] underline-offset-4 transition-colors hover:decoration-[#FCA5A5]"
                >
                  Forgot password?
                </Link>
              </span>
            </div>
          ) : null}
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

      <AuthPrimaryButton type="submit" disabled={loading}>
        {loading ? "Creating account…" : "Sign up"}
      </AuthPrimaryButton>
    </form>
  );
}
