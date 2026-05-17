"use client";

import { useEffect } from "react";

import {
  establishAuthSessionFromCurrentUrl,
  replaceUrlPathOnly,
} from "@/lib/auth/establish-session-from-url";
import { ONBOARDING_AUTH_READY_EVENT, persistOnboardingPendingOnUser } from "@/lib/auth/onboarding";
import { parseAuthCallbackParams } from "@/lib/auth/parse-auth-callback-url";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

function urlHasAuthTokens(href: string): boolean {
  const params = parseAuthCallbackParams(href);
  return !!(
    (params.token_hash && params.type) ||
    (params.access_token && params.refresh_token) ||
    params.code ||
    (typeof window !== "undefined" &&
      window.location.hash.length > 1 &&
      /access_token|code|type|token_hash/.test(window.location.hash))
  );
}

/**
 * Email confirm links sometimes land on `/screener` (or another protected route) with tokens
 * in the hash instead of `/auth/callback`. Exchange them here, then notify onboarding host.
 */
export function OnboardingAuthBootstrap() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!urlHasAuthTokens(window.location.href)) return;

    let cancelled = false;

    async function run() {
      const result = await establishAuthSessionFromCurrentUrl();
      if (cancelled || result.status !== "established") return;

      const supabase = getSupabaseBrowserClient();
      await persistOnboardingPendingOnUser(supabase);
      replaceUrlPathOnly(window.location.pathname + window.location.search);
      window.dispatchEvent(new Event(ONBOARDING_AUTH_READY_EVENT));
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
