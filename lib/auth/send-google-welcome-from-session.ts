"use client";

import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

/** POST welcome email using the fresh OAuth access token (cookies may not be set yet). */
export async function postGoogleWelcomeFromSession(): Promise<{
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

  const res = await fetch("/api/auth/google-welcome", {
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
    return {
      ok: false,
      reason: json.reason ?? json.error ?? `http_${res.status}`,
      message: json.message,
    };
  }

  return {
    ok: true,
    sent: json.sent,
    reason: json.reason,
    message: json.message,
  };
}
