"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";

import { establishAuthSessionFromCurrentUrl } from "@/lib/auth/establish-session-from-url";
import { postWelcomeTrialStartFromSession } from "@/lib/auth/send-welcome-trial-start-from-session";
import {
  appendOnboardingQuery,
  persistOnboardingPendingOnUser,
  shouldMarkOnboardingAfterAuth,
} from "@/lib/auth/onboarding";
import { consumeOAuthRedirectState } from "@/lib/auth/oauth-redirect-state";
import {
  parseAuthCallbackParams,
  urlHasAuthCallbackParams,
} from "@/lib/auth/parse-auth-callback-url";
import { PATH_APP_ENTRY } from "@/lib/auth/routes";
import { Spinner } from "@/components/ui/spinner";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

const REDIRECT_AFTER_SUCCESS_MS = 1500;
const REDIRECT_AFTER_ERROR_MS = 1500;
const SESSION_RETRY_MS = 200;
const SESSION_RETRY_COUNT = 8;

function safeNextPath(raw: string | null | undefined): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return PATH_APP_ENTRY;
  return raw;
}

async function resolveSignInDestination(next: string): Promise<string> {
  try {
    const res = await fetch(`/api/auth/post-login-redirect?next=${encodeURIComponent(next)}`);
    const data = (await res.json().catch(() => ({}))) as { redirectTo?: string };
    if (typeof data.redirectTo === "string" && data.redirectTo.startsWith("/")) {
      return data.redirectTo;
    }
  } catch {
    /* non-blocking */
  }
  return next;
}

function goTo(path: string) {
  window.location.replace(path);
}

async function waitForSession() {
  const supabase = getSupabaseBrowserClient();
  for (let attempt = 0; attempt < SESSION_RETRY_COUNT; attempt += 1) {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (session) return session;
    await new Promise((r) => setTimeout(r, SESSION_RETRY_MS));
  }
  return null;
}

function AuthCallbackSpinner() {
  return (
    <div className="flex justify-center py-2" role="status" aria-label="Signing you in">
      <Spinner className="size-6 text-[#09090B]" />
    </div>
  );
}

function AuthCallbackInner() {
  const searchParams = useSearchParams();

  useEffect(() => {
    let cancelled = false;

    async function finishSignIn(destination: string) {
      await new Promise((r) => setTimeout(r, REDIRECT_AFTER_SUCCESS_MS));
      if (!cancelled) goTo(destination);
    }

    async function run() {
      const href = window.location.href;
      const params = parseAuthCallbackParams(href);
      const stored = consumeOAuthRedirectState();
      const safeNext = safeNextPath(
        searchParams.get("next") ?? params.next ?? stored.next,
      );

      if (!urlHasAuthCallbackParams(href)) {
        const session = await waitForSession();
        if (session) {
          await finishSignIn(await resolveSignInDestination(safeNext));
          return;
        }

        await new Promise((r) => setTimeout(r, REDIRECT_AFTER_ERROR_MS));
        if (!cancelled) goTo("/login?error=missing_code");
        return;
      }

      const result = await establishAuthSessionFromCurrentUrl();
      if (cancelled) return;

      const session = await waitForSession();
      const established = result.status === "established" || Boolean(session);

      if (established && session) {
        let destination = safeNext;
        try {
          const supabase = getSupabaseBrowserClient();
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

        destination = await resolveSignInDestination(destination);
        await finishSignIn(destination);
        return;
      }

      if (result.status === "failed") {
        const reason = result.reason === "oauth_error" ? "oauth" : "session";
        await new Promise((r) => setTimeout(r, REDIRECT_AFTER_ERROR_MS));
        if (!cancelled) goTo(`/login?error=${reason}`);
        return;
      }

      await new Promise((r) => setTimeout(r, REDIRECT_AFTER_ERROR_MS));
      if (!cancelled) goTo("/login?error=missing_code");
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [searchParams]);

  return <AuthCallbackSpinner />;
}

export function AuthCallbackClient() {
  return (
    <Suspense fallback={<AuthCallbackSpinner />}>
      <AuthCallbackInner />
    </Suspense>
  );
}
