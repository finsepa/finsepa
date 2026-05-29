"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";

import { establishAuthSessionFromCurrentUrl } from "@/lib/auth/establish-session-from-url";
import { postGoogleWelcomeFromSession } from "@/lib/auth/send-google-welcome-from-session";
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
          await postGoogleWelcomeFromSession();
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
