"use client";

import { useState, type FormEvent } from "react";

const MIN_PASSWORD_LEN = 8;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function RequiredAsterisk() {
  return (
    <span className="text-[#DC2626]" aria-hidden="true">
      *
    </span>
  );
}
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  friendlyNetworkErrorMessage,
  friendlySupabaseAuthErrorMessage,
  messageWhenLoopsApiNotConfiguredOnServer,
  shouldAttemptLoopsSignupFallback,
} from "@/lib/auth/supabase-error-message";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { AuthDivider, AuthInput, AuthLabel, AuthPrimaryButton, AuthSecondaryButton } from "@/components/auth/auth-form-ui";
import { getAuthAppOriginForClient } from "@/lib/auth/app-origin";
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
    const url = `${typeof window !== "undefined" ? window.location.origin : ""}/api/auth/signup-with-loops`;
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

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [touched, setTouched] = useState({ firstName: false, email: false, password: false });

  const emailLooksValid = EMAIL_RE.test(email.trim());
  const firstOk = firstName.trim().length > 0;
  const passOk = password.length >= MIN_PASSWORD_LEN;
  const formCanSubmit = firstOk && email.trim().length > 0 && emailLooksValid && passOk;

  const showFirstError = touched.firstName && !firstOk;
  const showEmailError = touched.email && (!email.trim() || !emailLooksValid);
  const showPasswordError =
    touched.password && (password.length === 0 || password.length < MIN_PASSWORD_LEN);

  async function handleGoogle() {
    setErrorMessage(null);
    setIsDuplicateEmail(false);
    if (loading) return;
    setLoading(true);
    try {
      const supabase = getSupabaseBrowserClient();
      const authOrigin = getAuthAppOriginForClient();
      const redirectTo = `${authOrigin}${PATH_AUTH_CALLBACK}?next=${encodeURIComponent(PATH_APP_ENTRY)}`;
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
    if (!formCanSubmit) {
      setTouched({ firstName: true, email: true, password: true });
      return;
    }

    const emailNorm = email.trim().toLowerCase();
    const firstNorm = firstName.trim();
    const lastNorm = lastName.trim();

    setLoading(true);
    try {
      const supabase = getSupabaseBrowserClient();
      const authOrigin = getAuthAppOriginForClient();
      const apiOrigin = typeof window !== "undefined" ? window.location.origin : "";
      const emailRedirectTo = `${authOrigin}${PATH_AUTH_CALLBACK}?next=${encodeURIComponent(PATH_APP_ENTRY)}`;

      /** Sign out before leaving `/signup` so middleware does not treat the user as logged-in and redirect to `/screener`. */
      async function goToEmailConfirmation() {
        const { data: sess } = await supabase.auth.getSession();
        if (sess.session) await supabase.auth.signOut();
        router.replace(`/check-email?email=${encodeURIComponent(emailNorm)}`);
      }

      const loopsFirst = await trySignupViaLoopsApi({
        email: emailNorm,
        password,
        firstName: firstNorm,
        lastName: lastNorm,
        appOrigin: authOrigin,
      });
      if (loopsFirst.kind === "success") {
        await goToEmailConfirmation();
        return;
      }
      if (loopsFirst.kind === "duplicate") {
        setIsDuplicateEmail(true);
        setErrorMessage("An account with this email already exists.");
        setPassword("");
        return;
      }
      if (loopsFirst.kind === "error") {
        setErrorMessage(loopsFirst.message);
        return;
      }

      const { data, error } = await supabase.auth.signUp({
        email: emailNorm,
        password,
        options: {
          emailRedirectTo,
          data: {
            first_name: firstNorm,
            last_name: lastNorm || "-",
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
        setPassword("");
        return;
      }

      if (error) {
        if (shouldAttemptLoopsSignupFallback(error.message, error.code, error.status)) {
          let loopsRes: Response;
          try {
            loopsRes = await fetch(`${apiOrigin}/api/auth/signup-with-loops`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                email: emailNorm,
                password,
                firstName: firstNorm,
                lastName: lastNorm,
                appOrigin: authOrigin,
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
            setPassword("");
            return;
          }

          if (loopsRes.ok && loopsJson.ok === true) {
            await goToEmailConfirmation();
            return;
          }

          if (loopsJson.error === "loops_not_configured") {
            setErrorMessage(messageWhenLoopsApiNotConfiguredOnServer());
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

      await goToEmailConfirmation();
    } catch (err) {
      setErrorMessage(friendlyNetworkErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit} noValidate aria-label="Sign up">
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
          <AuthLabel>
            First name
            <RequiredAsterisk />
          </AuthLabel>
          <AuthInput
            name="firstName"
            autoComplete="given-name"
            placeholder="Ava"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            onBlur={() => setTouched((t) => ({ ...t, firstName: true }))}
            aria-invalid={showFirstError}
            aria-required="true"
            disabled={loading}
          />
          {showFirstError ? (
            <p className="mt-1 text-xs leading-4 text-[#DC2626]">First name is required.</p>
          ) : null}
        </div>
        <div>
          <AuthLabel>Last name</AuthLabel>
          <AuthInput
            name="lastName"
            autoComplete="family-name"
            placeholder="Johnson"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            disabled={loading}
          />
        </div>
      </div>

      <div>
        <AuthLabel>
          Email
          <RequiredAsterisk />
        </AuthLabel>
        <AuthInput
          type="email"
          name="email"
          autoComplete="email"
          placeholder="you@company.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onBlur={() => setTouched((t) => ({ ...t, email: true }))}
          aria-invalid={showEmailError}
          aria-required="true"
          disabled={loading}
        />
        {showEmailError ? (
          <p className="mt-1 text-xs leading-4 text-[#DC2626]">
            {!email.trim() ? "Email is required." : "Enter a valid email address."}
          </p>
        ) : null}
      </div>

      <div>
        <AuthLabel>
          Password
          <RequiredAsterisk />
        </AuthLabel>
        <AuthInput
          type="password"
          name="password"
          autoComplete="new-password"
          placeholder="Create a password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onBlur={() => setTouched((t) => ({ ...t, password: true }))}
          aria-invalid={showPasswordError}
          aria-required="true"
          disabled={loading}
        />
        {showPasswordError ? (
          <p className="mt-1 text-xs leading-4 text-[#DC2626]">
            {password.length === 0
              ? "Password is required."
              : `Password must be at least ${MIN_PASSWORD_LEN} characters.`}
          </p>
        ) : !passOk ? (
          <p className="mt-1 text-xs leading-4 text-[#71717A]">At least {MIN_PASSWORD_LEN} characters.</p>
        ) : null}
      </div>

      <AuthPrimaryButton type="submit" disabled={loading || !formCanSubmit}>
        {loading ? "Creating account…" : "Sign up"}
      </AuthPrimaryButton>
    </form>
  );
}
