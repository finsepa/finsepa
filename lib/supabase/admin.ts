import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { pickProcessEnv } from "@/lib/env/pick-process-env";
import { getSupabaseServiceRoleKey } from "@/lib/env/server";

/**
 * Service-role client for server-only aggregates (e.g. global watchlist counts).
 * Set `SUPABASE_SERVICE_ROLE_KEY` (or `SUPABASE_SERVICE_KEY`) in the server environment; if unset, returns null.
 */
export function getSupabaseAdminClient(): SupabaseClient | null {
  const url = pickProcessEnv("NEXT" + "_" + "PUBLIC" + "_" + "SUPABASE" + "_" + "URL");
  const key = getSupabaseServiceRoleKey();
  if (!url || !key) return null;

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
