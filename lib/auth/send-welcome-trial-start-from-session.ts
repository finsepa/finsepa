"use client";

import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

/** POST Welcome Trial Start using the fresh session token (cookies may not be set yet). */
export async function postWelcomeTrialStartFromSession(): Promise<{
  ok: boolean;
  sent?: boolean;
  reason?: string;
  message?: string;
}> {
  const supabase = getSupabaseBrowserClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const headers: HeadersInit = { "Content-Type": "application/json" };
  if (session?.access_token) {
    headers.Authorization = `Bearer ${session.access_token}`;
  }

  const res = await fetch("/api/auth/welcome-trial-start", {
    method: "POST",
    credentials: "include",
    headers,
  });

  const json = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    sent?: boolean;
    reason?: string;
    message?: string;
    error?: string;
  };

  if (!res.ok) {
    const out = {
      ok: false,
      reason: json.reason ?? json.error ?? `http_${res.status}`,
      message: json.message,
    };
    if (process.env.NODE_ENV === "development") {
      console.warn("[welcome-trial-start] callback:", out);
    }
    return out;
  }

  const out = {
    ok: true,
    sent: json.sent,
    reason: json.reason,
    message: json.message,
  };
  if (process.env.NODE_ENV === "development" && !json.sent) {
    console.warn("[welcome-trial-start] callback skipped:", out);
  }
  return out;
}

/** @deprecated Use {@link postWelcomeTrialStartFromSession}. */
export const postGoogleWelcomeFromSession = postWelcomeTrialStartFromSession;
