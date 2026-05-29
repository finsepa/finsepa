"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";

import { establishAuthSessionFromCurrentUrl } from "@/lib/auth/establish-session-from-url";
import {
  appendOnboardingQuery,
  persistOnboardingPendingOnUser,
  shouldMarkOnboardingAfterAuth,
} from "@/lib/auth/onboarding";
import { parseAuthCallbackParams } from "@/lib/auth/parse-auth-callback-url";
import { PATH_APP_ENTRY } from "@/lib/auth/routes";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

function safeNextPath(raw: string | null | undefined): string {
  const fallback = PATH_APP_ENTRY;
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return fallback;
  return raw;
}

/** Full navigation avoids Next.js soft-navigation RSC fetch failures after auth (common in dev / Turbopack). */
function goTo(path: string) {
  window.location.replace(path);
}

const GOOGLE_WELCOME_POST_MS = 8000;

/** Wait for welcome email API — immediate redirect aborts fire-and-forget fetch. */
async function sendGoogleWelcomeAfterAuth(): Promise<void> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), GOOGLE_WELCOME_POST_MS);
  try {
    await fetch("/api/auth/google-welcome", {
      method: "POST",
      credentials: "include",
      signal: controller.signal,
    });
  } catch {
    /* non-blocking */
  } finally {
    window.clearTimeout(timeout);
  }
}

function AuthCallbackInner() {
  const searchParams = useSearchParams();

  useEffect(() => {
    let cancelled = false;

    async function run() {
      const href = window.location.href;
      const params = parseAuthCallbackParams(href);

      const nextFromQuery = searchParams.get("next");
      const nextFromParams = params.next;
      const nextRaw = nextFromQuery ?? nextFromParams;
      const safeNext = safeNextPath(nextRaw);

      const result = await establishAuthSessionFromCurrentUrl();
      if (cancelled) return;

      if (result.status === "established") {
        let destination = safeNext;
        try {
          const supabase = getSupabaseBrowserClient();
          const {
            data: { session },
          } = await supabase.auth.getSession();
          const user = session?.user ?? null;
          const authType = params.type ?? searchParams.get("type");
          if (shouldMarkOnboardingAfterAuth(user, authType)) {
            await persistOnboardingPendingOnUser(supabase);
            destination = appendOnboardingQuery(safeNext);
          }
          await sendGoogleWelcomeAfterAuth();
        } catch {
          /* non-blocking */
        }
        goTo(destination);
        return;
      }
      if (result.status === "failed") {
        goTo(`/login?error=session`);
        return;
      }
      goTo(`/login?error=missing_code`);
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [searchParams]);

  return null;
}

export function AuthCallbackClient() {
  return (
    <Suspense fallback={null}>
      <AuthCallbackInner />
    </Suspense>
  );
}
