import type { User } from "@supabase/supabase-js";

/** True when the account has an email/password identity (not Google-only). */
export function userHasPasswordIdentity(user: User | null | undefined): boolean {
  if (!user) return false;
  return (user.identities ?? []).some((identity) => identity.provider === "email");
}
