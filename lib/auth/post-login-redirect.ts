import type { SupabaseClient } from "@supabase/supabase-js";

import { PATH_APP_ENTRY } from "@/lib/auth/routes";

export function safePostLoginNextPath(raw: string | null | undefined): string | null {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return null;
  return raw;
}

/** Where to send the user immediately after a successful sign-in. */
export async function resolvePostLoginPath(
  _supabase: SupabaseClient,
  next?: string | null,
): Promise<string> {
  // Free plan replaces hard paywall — all authenticated users enter the app.
  return safePostLoginNextPath(next) ?? PATH_APP_ENTRY;
}
