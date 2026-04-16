"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  friendlyNetworkErrorMessage,
  friendlySupabaseAuthErrorMessage,
  shouldAttemptLoopsSignupFallback,
} from "@/lib/auth/supabase-error-message";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { AuthDivider, AuthInput, AuthLabel, AuthPrimaryButton, AuthSecondaryButton } from "@/components/auth/auth-form-ui";
import { PATH_APP_ENTRY, PATH_AUTH_CALLBACK } from "@/lib/auth/routes";

type LoopsFirstResult =
  | { kind: "success" }
  | { kind: "duplicate" }
  | { kind: "use_client_signup" }
  | { kind: "error"; message: string };

async function trySignupViaLoopsApi(body: {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  appOrigin: string;
}): Promise<LoopsFirstResult> {
  let loopsRes: Response;
  try {
    const url = `${window.location.origin}/api/auth/signup-with-loops`;
    loopsRes = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    // Fetch never got a response (embedded preview blocking localhost, dev server down, etc.).
    // Fall back to client signUp so a normal misconfiguration still shows a JSON error from the API.
    return { kind: "use_client_signup" };
  }
  const loopsJson = (await loopsRes.json().catch(() => ({}))) as {
    ok?: boolean;
    error?: string;
    message?: string;
  };

  if (loopsRes.ok && loopsJson.ok === true) return { kind: "success" };
  if (loopsRes.status === 409 || loopsJson.error === "duplicate_email") return { kind: "duplicate" };
  if (loopsJson.error === "loops_not_configured" || loopsJson.error === "admin_unavailable") {
    return { kind: "use_client_signup" };
  }

  return {
    kind: "error",
    message:
      loopsJson.message?.trim() ||
      "We could not send your confirmation email via Loops. Set LOOPS_API_KEY and SUPABASE_SERVICE_ROLE_KEY (see .env.example). Your Loops template needs data variables: firstName, confirmationLink.",
  };
}

function GoogleMark() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4">
      <path
        fill="#EA4335"
        d="M12 10.2v3.9h5.4c-.2 1.3-1.6 3.8-5.4 3.8-3.2 0-5.9-2.7-5.9-5.9S8.8 6.1 12 6.1c1.8 0 3 .8 3.7 1.4l2.5-2.4C16.8 3.8 14.7 3 12 3 7 3 3 7 3 12s4 9 9 9c5.2 0 8.6-3.7 8.6-8.9 0-.6-.1-1-.1-1.4H12z"
      />
    </svg>
  );
}

export function SignupClient() {
  const router = useRouter();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDuplicateEmail, setIsDuplicateEmail] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleGoogle() {
    setErrorMessage(null);
    setIsDuplicateEmail(false);
    if (loading) return;
    setLoading(true);
    try {
      const supabase = getSupabaseBrowserClient();
      const origin = window.location.origin;
      const redirectTo = `${origin}${PATH_AUTH_CALLBACK}?next=${encodeURIComponent(PATH_APP_ENTRY)}`;
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo },
      });
      if (error) {
        setErrorMessage(friendlySupabaseAuthErrorMessage(error.message));
        setLoading(false);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong. Please try again.";
      setErrorMessage(message);
      setLoading(false);
    }
  }

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
      const origin = window.location.origin;
      const emailRedirectTo = `${origin}${PATH_AUTH_CALLBACK}?next=${encodeURIComponent(PATH_APP_ENTRY)}`;

      const loopsFirst = await trySignupViaLoopsApi({
        email,
        password,
        firstName,
        lastName,
        appOrigin: origin,
      });
      if (loopsFirst.kind === "success") {
        router.refresh();
        const { data: sess } = await supabase.auth.getSession();
        if (sess.session) await supabase.auth.signOut();
        router.push(`/check-email?email=${encodeURIComponent(email)}`);
        return;
      }
      if (loopsFirst.kind === "duplicate") {
        setIsDuplicateEmail(true);
        setErrorMessage("An account with this email already exists.");
        const passwordInput = form.querySelector<HTMLInputElement>('input[name="password"]');
        if (passwordInput) passwordInput.value = "";
        return;
      }
      if (loopsFirst.kind === "error") {
        setErrorMessage(loopsFirst.message);
        return;
      }

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo,
          data: {
            first_name: firstName,
            last_name: lastName,
          },
        },
      });

      const errMsg = error?.message ?? "";
      const looksLikeDuplicate =
        !!error &&
        (error.status === 409 ||
          error.status === 422 ||
          /already registered|already exists|user exists|email.*registered/i.test(errMsg));

      const duplicateByIdentity = !!data?.user && Array.isArray(data.user.identities) && data.user.identities.length === 0;

      if (looksLikeDuplicate || duplicateByIdentity) {
        setIsDuplicateEmail(true);
        setErrorMessage("An account with this email already exists.");
        const passwordInput = form.querySelector<HTMLInputElement>('input[name="password"]');
        if (passwordInput) passwordInput.value = "";
        return;
      }

      if (error) {
        if (shouldAttemptLoopsSignupFallback(error.message, error.code, error.status)) {
          let loopsRes: Response;
          try {
            loopsRes = await fetch(`${origin}/api/auth/signup-with-loops`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                email,
                password,
                firstName,
                lastName,
                appOrigin: origin,
              }),
            });
          } catch (err) {
            setErrorMessage(friendlyNetworkErrorMessage(err));
            return;
          }
          const loopsJson = (await loopsRes.json().catch(() => ({}))) as {
            ok?: boolean;
            error?: string;
            message?: string;
          };

          if (loopsRes.status === 409 || loopsJson.error === "duplicate_email") {
            setIsDuplicateEmail(true);
            setErrorMessage("An account with this email already exists.");
            const passwordInput = form.querySelector<HTMLInputElement>('input[name="password"]');
            if (passwordInput) passwordInput.value = "";
            return;
          }

          if (loopsRes.ok && loopsJson.ok === true) {
            router.refresh();
            const { data: sess } = await supabase.auth.getSession();
            if (sess.session) await supabase.auth.signOut();
            router.push(`/check-email?email=${encodeURIComponent(email)}`);
            return;
          }

          if (loopsJson.error === "loops_not_configured") {
            setErrorMessage(friendlySupabaseAuthErrorMessage(error.message));
            return;
          }

          if (loopsJson.error === "admin_unavailable") {
            setErrorMessage(
              "Confirmation via Loops needs a Supabase service role on the server. Add SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SERVICE_KEY) in `.env.local` (local) or Vercel (production), restart dev / redeploy, and try again.",
            );
            return;
          }

          setErrorMessage(
            loopsJson.message?.trim() ||
              "We could not send your confirmation email via Loops. In Vercel, set LOOPS_API_KEY. Your Loops transactional template must define data variables: firstName, confirmationLink.",
          );
          return;
        }

        setErrorMessage(friendlySupabaseAuthErrorMessage(error.message));
        return;
      }

      router.refresh();

      if (data.session) {
        await supabase.auth.signOut();
      }

      const emailParam = encodeURIComponent(email);
      router.push(`/check-email?email=${emailParam}`);
    } catch (err) {
      setErrorMessage(friendlyNetworkErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit} noValidate>
      <AuthSecondaryButton onClick={handleGoogle} disabled={loading}>
        <GoogleMark />
        {loading ? "Redirecting…" : "Continue with Google"}
      </AuthSecondaryButton>

      <AuthDivider />

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
