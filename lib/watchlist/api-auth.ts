import type { SupabaseClient } from "@supabase/supabase-js";
import type { User } from "@supabase/supabase-js";

import { resolveAuthUserFromRequest } from "@/lib/auth/resolve-auth-user";

export async function requireAuthUser(supabase: SupabaseClient): Promise<User> {
  try {
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
