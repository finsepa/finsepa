"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

import {
  parseAuthCallbackParams,
  urlHasAuthCallbackParams,
} from "@/lib/auth/parse-auth-callback-url";
import { PATH_AUTH_CALLBACK, PATH_AUTH_RESET_PASSWORD } from "@/lib/auth/routes";

/**
 * Recovery/signup links from Supabase verify sometimes land on `/login` or `/` with tokens in the
 * hash when `redirect_to` is rejected. Send users to the correct auth page before exchanging tokens.
 */
export function AuthTokenLandingBootstrap() {
  const pathname = usePathname();

  useEffect(() => {
    if (typeof window === "undefined") return;
    const href = window.location.href;
    if (!urlHasAuthCallbackParams(href)) return;

    const params = parseAuthCallbackParams(href);
    const suffix = `${window.location.search}${window.location.hash}`;

    if (params.type === "recovery" && pathname !== PATH_AUTH_RESET_PASSWORD) {
      window.location.replace(`${PATH_AUTH_RESET_PASSWORD}${suffix}`);
      return;
    }

    if (
      (params.type === "signup" || params.type === "email" || params.type === "invite") &&
      pathname !== PATH_AUTH_CALLBACK
    ) {
      window.location.replace(`${PATH_AUTH_CALLBACK}${suffix}`);
    }
  }, [pathname]);

  return null;
}
