"use client";

import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { resolveSupabaseAccessToken } from "@/lib/supabase/safe-auth";

async function watchlistAuthHeaders(): Promise<Record<string, string>> {
  const token = await resolveSupabaseAccessToken(getSupabaseBrowserClient());
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function mergeHeaders(
  authHeaders: Record<string, string>,
  initHeaders?: HeadersInit,
): Headers {
  const headers = new Headers(initHeaders);
  for (const [key, value] of Object.entries(authHeaders)) {
    if (!headers.has(key)) headers.set(key, value);
  }
  return headers;
}

/** Authenticated fetch for watchlist API routes (cookies + Bearer, refresh once on 401). */
export async function watchlistApiFetch(
  input: string,
  init: RequestInit = {},
): Promise<Response> {
  const supabase = getSupabaseBrowserClient();
  const authHeaders = await watchlistAuthHeaders();
  let res = await fetch(input, {
    ...init,
    credentials: "include",
    cache: "no-store",
    headers: mergeHeaders(authHeaders, init.headers),
  });

  if (res.status !== 401) return res;

  const token = await resolveSupabaseAccessToken(supabase, { forceRefresh: true });
  if (!token) return res;

  return fetch(input, {
    ...init,
    credentials: "include",
    cache: "no-store",
    headers: mergeHeaders({ Authorization: `Bearer ${token}` }, init.headers),
  });
}
