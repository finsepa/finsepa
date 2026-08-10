"use client";

import { useEffect } from "react";

import {
  establishAuthSessionFromCurrentUrl,
  replaceUrlPathOnly,
} from "@/lib/auth/establish-session-from-url";
import { postWelcomeTrialStartFromSession } from "@/lib/auth/send-welcome-trial-start-from-session";
import { parseAuthCallbackParams } from "@/lib/auth/parse-auth-callback-url";

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
 * in the hash instead of `/auth/callback`. Exchange them here so the session is established.
 */
export function AuthSessionUrlBootstrap() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!urlHasAuthTokens(window.location.href)) return;

    let cancelled = false;

    async function run() {
      const result = await establishAuthSessionFromCurrentUrl();
      if (cancelled || result.status !== "established") return;

      // Do not await Loops — must not block the protected shell on mobile.
      void postWelcomeTrialStartFromSession();
      replaceUrlPathOnly(window.location.pathname + window.location.search);
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}

/** @deprecated Use {@link AuthSessionUrlBootstrap}. */
export const OnboardingAuthBootstrap = AuthSessionUrlBootstrap;
