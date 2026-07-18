import "server-only";

import { createClient, type User } from "@supabase/supabase-js";

import { getSupabaseServerClient } from "@/lib/supabase/server";
import { supabaseAuthTimedFetch } from "@/lib/supabase/auth-fetch-timeout";

/**
 * Resolve the signed-in user from `Authorization: Bearer <access_token>` or session cookies.
 * OAuth callback often runs before cookies are visible to Route Handlers — prefer the Bearer path.
 */
export async function resolveAuthUserFromRequest(request: Request): Promise<User | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

  const authHeader = request.headers.get("authorization");
  const bearer = authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";

  if (bearer && url && anonKey) {
    const jwtClient = createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: supabaseAuthTimedFetch },
    });
    try {
      const { data, error } = await jwtClient.auth.getUser(bearer);
      if (!error && data.user) return data.user;
    } catch {
      /* Auth outage — fall through to cookie session */
    }
  }

  try {
    const supabase = await getSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return user;
  } catch {
    return null;
  }
}
