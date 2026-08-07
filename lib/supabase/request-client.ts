import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { supabaseAuthTimedFetch } from "@/lib/supabase/auth-fetch-timeout";
import { getSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Cookie session or Bearer JWT client (native iOS).
 * Use for Route Handlers that need RLS `auth.uid()` with Bearer tokens.
 */
export async function getSupabaseClientForRequest(request: Request): Promise<SupabaseClient> {
  const authHeader = request.headers.get("authorization");
  const bearer = authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  if (bearer) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
    const key =
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
    if (!url || !key) {
      throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
    }
    return createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: {
        headers: { Authorization: `Bearer ${bearer}` },
        fetch: supabaseAuthTimedFetch,
      },
    });
  }
  return getSupabaseServerClient();
}
