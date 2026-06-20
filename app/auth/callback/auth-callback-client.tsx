"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

import { establishAuthSessionFromCurrentUrl } from "@/lib/auth/establish-session-from-url";
import { postWelcomeTrialStartFromSession } from "@/lib/auth/send-welcome-trial-start-from-session";
import {
  appendOnboardingQuery,
  persistOnboardingPendingOnUser,
  shouldMarkOnboardingAfterAuth,
} from "@/lib/auth/onboarding";
import {
  consumeOAuthRedirectState,
  consumePostAuthDestination,
  persistPostAuthDestination,
} from "@/lib/auth/oauth-redirect-state";
import { parseAuthCallbackParams } from "@/lib/auth/parse-auth-callback-url";
import { PATH_APP_ENTRY } from "@/lib/auth/routes";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

const REDIRECT_AFTER_WELCOME_MS = 1500;
const REDIRECT_AFTER_ERROR_MS = 2500;

type CallbackPhase = "working" | "success" | "error" | "welcome";

function safeNextPath(raw: string | null | undefined): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return PATH_APP_ENTRY;
  return raw;
}

function goTo(path: string) {
  window.location.replace(path);
}

function CallbackStatus({ phase, message }: { phase: CallbackPhase; message: string }) {
  if (phase === "welcome") return null;

  if (phase === "success") {
    return (
      <div
        role="status"
        className="rounded-[10px] border border-[#BBF7D0] bg-[#F0FDF4] px-3 py-2.5 text-center text-sm font-medium leading-5 text-[#166534] shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
      >
        {message}
      </div>
    );
  }

  if (phase === "error") {
    return (
      <div
        role="alert"
        className="rounded-[10px] border border-[#FECACA] bg-[#FEF2F2] px-3 py-2.5 text-center text-sm leading-5 text-[#B91C1C]"
      >
        {message}
      </div>
    );
  }

  return (
    <div
      role="status"
      className="rounded-[10px] border border-[#E4E4E7] bg-[#FAFAFA] px-3 py-2.5 text-center text-sm leading-5 text-[#52525B]"
    >
      {message}
    </div>
  );
}

function AuthCallbackInner() {
  const searchParams = useSearchParams();
  const [phase, setPhase] = useState<CallbackPhase>("working");
  const [message, setMessage] = useState("Confirming your Google account…");

  useEffect(() => {
    let cancelled = false;

    async function run() {
      const isWelcomeStep = searchParams.get("welcome") === "1";

      if (isWelcomeStep) {
        setPhase("welcome");
        const supabase = getSupabaseBrowserClient();
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session) {
          setPhase("error");
          setMessage("Your session expired. Redirecting to login…");
          await new Promise((r) => setTimeout(r, REDIRECT_AFTER_ERROR_MS));
          if (!cancelled) goTo("/login?error=session");
          return;
        }

        const destination = safeNextPath(consumePostAuthDestination());
        await new Promise((r) => setTimeout(r, REDIRECT_AFTER_WELCOME_MS));
        if (!cancelled) goTo(destination);
        return;
      }

      const href = window.location.href;
      const params = parseAuthCallbackParams(href);
      const stored = consumeOAuthRedirectState();
      const safeNext = safeNextPath(
        searchParams.get("next") ?? params.next ?? stored.next,
      );

      if (!params.code && !params.token_hash) {
        setPhase("error");
        setMessage("Sign-in did not include a verification code. Redirecting to login…");
        await new Promise((r) => setTimeout(r, REDIRECT_AFTER_ERROR_MS));
        if (!cancelled) goTo("/login?error=missing_code");
        return;
      }

      const result = await establishAuthSessionFromCurrentUrl();
      if (cancelled) return;

      if (result.status === "established") {
        const supabase = getSupabaseBrowserClient();
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session) {
          setPhase("error");
          setMessage("Sign-in finished but your session was not saved. Redirecting to login…");
          await new Promise((r) => setTimeout(r, REDIRECT_AFTER_ERROR_MS));
          if (!cancelled) goTo("/login?error=session");
          return;
        }

        let destination = safeNext;
        try {
          const user = session.user ?? null;
          const authType = params.type ?? searchParams.get("type") ?? stored.intent;
          if (shouldMarkOnboardingAfterAuth(user, authType)) {
            await persistOnboardingPendingOnUser(supabase);
            destination = appendOnboardingQuery(safeNext);
          }
          await postWelcomeTrialStartFromSession();
        } catch {
          /* non-blocking */
        }

        if (params.code) {
          persistPostAuthDestination(destination);
          if (!cancelled) goTo("/login?success=google");
          return;
        }

        setPhase("success");
        setMessage("You're in! Redirecting to Finsepa…");
        await new Promise((r) => setTimeout(r, REDIRECT_AFTER_WELCOME_MS));
        if (!cancelled) goTo(destination);
        return;
      }

      if (result.status === "failed") {
        const reason = result.reason === "oauth_error" ? "oauth" : "session";
        setPhase("error");
        setMessage(
          reason === "oauth"
            ? "Google sign-in was cancelled or blocked. Redirecting to login…"
            : "We could not finish signing you in. Redirecting to login…",
        );
        await new Promise((r) => setTimeout(r, REDIRECT_AFTER_ERROR_MS));
        if (!cancelled) goTo(`/login?error=${reason}`);
        return;
      }

      setPhase("error");
      setMessage("That sign-in link is incomplete. Redirecting to login…");
      await new Promise((r) => setTimeout(r, REDIRECT_AFTER_ERROR_MS));
      if (!cancelled) goTo("/login?error=missing_code");
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [searchParams]);

  return <CallbackStatus phase={phase} message={message} />;
}

export function AuthCallbackClient() {
  return (
    <Suspense fallback={<CallbackStatus phase="working" message="Confirming your Google account…" />}>
      <AuthCallbackInner />
    </Suspense>
  );
}
