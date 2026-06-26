import type { Session, SupabaseClient } from "@supabase/supabase-js";

/** Read the current session from storage without a network round-trip. */
export async function readSupabaseSession(
  supabase: SupabaseClient,
): Promise<Session | null> {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    return session;
  } catch {
    return null;
  }
}

/**
 * Refresh only when a refresh token exists. Swallows network failures so callers
 * (watchlist sync, etc.) do not surface `TypeError: Failed to fetch` overlays.
 */
export async function safeRefreshSupabaseSession(
  supabase: SupabaseClient,
): Promise<Session | null> {
  try {
    const session = await readSupabaseSession(supabase);
    if (!session?.refresh_token) return null;

    const { data, error } = await supabase.auth.refreshSession();
    if (error || !data.session?.access_token) return null;
    return data.session;
  } catch {
    return null;
  }
}

/** Bearer token for API calls — session first, one guarded refresh when needed. */
export async function resolveSupabaseAccessToken(
  supabase: SupabaseClient,
  options: { forceRefresh?: boolean } = {},
): Promise<string | null> {
  const { forceRefresh = false } = options;

  try {
    const session = await readSupabaseSession(supabase);
    if (!forceRefresh && session?.access_token) {
      return session.access_token;
    }
    const refreshed = await safeRefreshSupabaseSession(supabase);
    return refreshed?.access_token ?? null;
  } catch {
    return null;
  }
}
