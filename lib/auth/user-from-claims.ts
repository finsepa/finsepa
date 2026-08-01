import type { JwtPayload, User } from "@supabase/supabase-js";

/**
 * Build a minimal {@link User} from verified JWT claims (`auth.getClaims()`).
 * Enough for API/middleware identity (`user.id`); not a full Auth-server record.
 */
export function userFromJwtClaims(claims: JwtPayload | null | undefined): User | null {
  if (!claims) return null;
  const id = typeof claims.sub === "string" ? claims.sub.trim() : "";
  if (!id) return null;

  const email = typeof claims.email === "string" ? claims.email : undefined;
  const phone = typeof claims.phone === "string" ? claims.phone : undefined;
  const appMetadata =
    claims.app_metadata && typeof claims.app_metadata === "object"
      ? (claims.app_metadata as User["app_metadata"])
      : {};
  const userMetadata =
    claims.user_metadata && typeof claims.user_metadata === "object"
      ? (claims.user_metadata as User["user_metadata"])
      : {};

  return {
    id,
    aud: typeof claims.aud === "string" ? claims.aud : "authenticated",
    role: typeof claims.role === "string" ? claims.role : "authenticated",
    email,
    phone,
    app_metadata: appMetadata,
    user_metadata: userMetadata,
    created_at: "",
  } as User;
}
