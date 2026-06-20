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
import { parseAuthCallbackParams } from "@/lib/auth/parse-auth-callback-url";
import { PATH_APP_ENTRY } from "@/lib/auth/routes";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

const REDIRECT_AFTER_SUCCESS_MS = 2000;
const REDIRECT_AFTER_ERROR_MS = 2500;

type CallbackPhase = "working" | "success" | "error";

function safeNextPath(raw: string | null | undefined): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return PATH_APP_ENTRY;
  return raw;
}

function goTo(path: string) {
  window.location.replace(path);
}

function CallbackStatus({ phase, message }: { phase: CallbackPhase; message: string }) {
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
      const href = window.location.href;
      const params = parseAuthCallbackParams(href);
      const safeNext = safeNextPath(searchParams.get("next") ?? params.next);

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

        setPhase("success");
        setMessage("You're in! Redirecting to Finsepa…");

        let destination = safeNext;
        try {
          const user = session.user ?? null;
          const authType = params.type ?? searchParams.get("type");
          if (shouldMarkOnboardingAfterAuth(user, authType)) {
            await persistOnboardingPendingOnUser(supabase);
            destination = appendOnboardingQuery(safeNext);
          }
          await postWelcomeTrialStartFromSession();
        } catch {
          /* non-blocking */
        }

        await new Promise((r) => setTimeout(r, REDIRECT_AFTER_SUCCESS_MS));
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
