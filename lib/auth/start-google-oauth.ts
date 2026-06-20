"use client";

import type { SupabaseClient } from "@supabase/supabase-js";

import { PATH_APP_ENTRY, PATH_AUTH_CALLBACK } from "@/lib/auth/routes";

/**
 * Starts Google OAuth in the browser (same cookie path as email/password login).
 * Uses an explicit redirect because auto-redirect is unreliable in some browsers.
 */
export async function startGoogleOAuth(
  supabase: SupabaseClient,
  options?: { next?: string; intent?: "signup" | "login" },
): Promise<void> {
  const next = options?.next ?? PATH_APP_ENTRY;
  const callbackParams = new URLSearchParams({ next });
  if (options?.intent === "signup") callbackParams.set("type", "signup");
  const redirectTo = `${window.location.origin}${PATH_AUTH_CALLBACK}?${callbackParams.toString()}`;

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
