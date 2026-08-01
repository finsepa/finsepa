import type { SupabaseClient } from "@supabase/supabase-js";
import type { User } from "@supabase/supabase-js";

import { userFromJwtClaims } from "@/lib/auth/user-from-claims";
import { resolveAuthUserFromRequest } from "@/lib/auth/resolve-auth-user";

/**
 * Prefer local JWT verification (`getClaims`) so portfolio/notification fan-out
 * does not stampede Auth with `getUser()` network calls. Falls back to `getUser`
 * when claims are unavailable (e.g. symmetric JWT / cold JWKS).
 */
export async function requireAuthUser(supabase: SupabaseClient): Promise<User> {
  try {
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
    if (!claimsError) {
      const fromClaims = userFromJwtClaims(claimsData?.claims ?? null);
      if (fromClaims) return fromClaims;
    }

    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      throw new AuthRequiredError();
    }
    return user;
  } catch (e) {
    if (e instanceof AuthRequiredError) throw e;
    // Supabase Auth 522 / network blips surface as AuthRetryableFetchError.
    throw new AuthRequiredError();
  }
}

/** Prefer in Route Handlers — accepts Bearer token when cookies are stale. */
export async function requireAuthUserFromRequest(request: Request): Promise<User> {
  const user = await resolveAuthUserFromRequest(request);
  if (!user) throw new AuthRequiredError();
  return user;
}

export class AuthRequiredError extends Error {
  constructor() {
    super("Unauthorized");
    this.name = "AuthRequiredError";
  }
}
