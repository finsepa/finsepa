import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Sign out of the current device/browser session only.
 * Default `signOut()` is global and would revoke iOS + web together.
 */
export async function signOutLocalSession(supabase: SupabaseClient): Promise<void> {
  await supabase.auth.signOut({ scope: "local" });
}
