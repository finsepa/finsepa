"use client";

import { createClient } from "@supabase/supabase-js";

import { parseAuthCallbackParams } from "@/lib/auth/parse-auth-callback-url";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

export type EstablishAuthUrlResult =
  | { status: "established" }
  | { status: "none" }
  | { status: "failed"; reason: "oauth_error" | "session_error" };

/**
 * Reads PKCE / implicit / token_hash params from the current URL and writes the session
 * to the shared Supabase browser client (cookies). Call from `/auth/callback` or
 * `/auth/reset-password` when the recovery link targets that page directly.
 */
export async function establishAuthSessionFromCurrentUrl(): Promise<EstablishAuthUrlResult> {
  if (typeof window === "undefined") return { status: "none" };

  const href = window.location.href;
  const params = parseAuthCallbackParams(href);

  const hasConsumable =
    !!(params.token_hash && params.type) ||
    !!(params.access_token && params.refresh_token) ||
    !!params.code ||
    (typeof window !== "undefined" &&
      window.location.hash.length > 1 &&
      /access_token|code|type|token_hash/.test(window.location.hash));

  if (!hasConsumable) {
    return { status: "none" };
  }

  if (params.error || params.error_description) {
    return { status: "failed", reason: "oauth_error" };
  }

  const supabase = getSupabaseBrowserClient();

  const token_hash = params.token_hash;
  const typeRaw = params.type;
  if (token_hash && typeRaw) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash,
      type: typeRaw as "signup" | "invite" | "magiclink" | "recovery" | "email_change" | "email",
    });
    if (!error) return { status: "established" };
    return { status: "failed", reason: "session_error" };
  }

  if (params.access_token && params.refresh_token) {
    const { error } = await supabase.auth.setSession({
      access_token: params.access_token,
      refresh_token: params.refresh_token,
    });
    if (!error) return { status: "established" };
    return { status: "failed", reason: "session_error" };
  }

  const code = params.code;
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return { status: "established" };
    return { status: "failed", reason: "session_error" };
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (url && key) {
    const implicit = createClient(url, key, {
      auth: {
        flowType: "implicit",
        autoRefreshToken: true,
        persistSession: false,
        detectSessionInUrl: true,
      },
    });
    await implicit.auth.initialize();
    const {
      data: { session: implicitSession },
    } = await implicit.auth.getSession();
    if (implicitSession) {
      const { error } = await supabase.auth.setSession({
        access_token: implicitSession.access_token,
        refresh_token: implicitSession.refresh_token,
      });
      if (!error) return { status: "established" };
      return { status: "failed", reason: "session_error" };
    }
  }

  return { status: "failed", reason: "session_error" };
}

/** Strip tokens from the address bar after a successful exchange (same path, no query/hash). */
export function replaceUrlPathOnly(pathname: string) {
  if (typeof window === "undefined") return;
  const origin = window.location.origin;
  window.history.replaceState({}, "", `${origin}${pathname.startsWith("/") ? pathname : `/${pathname}`}`);
}
