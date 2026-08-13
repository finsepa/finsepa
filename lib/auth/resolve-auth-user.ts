import "server-only";

import { createClient, type User } from "@supabase/supabase-js";

import { userFromJwtClaims } from "@/lib/auth/user-from-claims";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import {
  SUPABASE_AUTH_BROWSER_FETCH_TIMEOUT_MS,
  supabaseAuthTimedFetch,
} from "@/lib/supabase/auth-fetch-timeout";

/**
 * Resolve the signed-in user from `Authorization: Bearer <access_token>` or session cookies.
 * OAuth callback often runs before cookies are visible to Route Handlers — prefer the Bearer path.
 *
 * Uses `getClaims()` (local JWT verify when asymmetric keys) before `getUser()` so Auth
 * outages / latency do not turn every API into a slow 401.
 */
export async function resolveAuthUserFromRequest(request: Request): Promise<User | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  // Match middleware — publishable key is the new name for anon on some projects.
  const anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();

  const authHeader = request.headers.get("authorization");
  const bearer = authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";

  if (bearer && url && anonKey) {
    // Native clients (iOS) only send Bearer — give Auth/JWKS enough time (4s default is tight).
    const bearerFetch: typeof fetch = (input, init) =>
      supabaseAuthTimedFetch(input, init, SUPABASE_AUTH_BROWSER_FETCH_TIMEOUT_MS);

    const jwtClient = createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: bearerFetch },
    });
    try {
      const { data, error } = await jwtClient.auth.getClaims(bearer);
      if (!error) {
        const fromClaims = userFromJwtClaims(data?.claims ?? null);
        if (fromClaims) return fromClaims;
      }
      const { data: userData, error: userError } = await jwtClient.auth.getUser(bearer);
      if (!userError && userData.user) return userData.user;
    } catch {
      /* Auth outage — fall through to cookie session */
    }
  }

  try {
    const supabase = await getSupabaseServerClient();
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
    if (!claimsError) {
      const fromClaims = userFromJwtClaims(claimsData?.claims ?? null);
      if (fromClaims) return fromClaims;
    }
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return user;
  } catch {
    return null;
  }
}
