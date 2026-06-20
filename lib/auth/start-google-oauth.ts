"use client";

import type { SupabaseClient } from "@supabase/supabase-js";

import { persistOAuthRedirectState } from "@/lib/auth/oauth-redirect-state";
import { PATH_APP_ENTRY, PATH_AUTH_CALLBACK } from "@/lib/auth/routes";

/**
 * Starts Google OAuth in the browser.
 * redirectTo must be an exact Supabase allow-listed URL (no query string).
 */
export async function startGoogleOAuth(
  supabase: SupabaseClient,
  options?: { next?: string; intent?: "signup" | "login" },
): Promise<void> {
  const next = options?.next ?? PATH_APP_ENTRY;
  persistOAuthRedirectState({ next, intent: options?.intent });

  // Supabase only allows exact redirect URLs — ?next=… is rejected and users land on Site URL with no code.
  const redirectTo = `${window.location.origin}${PATH_AUTH_CALLBACK}`;

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo,
      skipBrowserRedirect: true,
    },
  });

  if (error) throw error;
  if (!data?.url) {
    throw new Error("Google sign-in could not start. Refresh the page and try again.");
  }

  window.location.assign(data.url);
}
