import type { SupabaseClient } from "@supabase/supabase-js";

import { getSubscriptionGateContext } from "@/lib/account/subscription-gate";
import { PATH_ACTIVATE_SUBSCRIPTION, PATH_APP_ENTRY } from "@/lib/auth/routes";

export function safePostLoginNextPath(raw: string | null | undefined): string | null {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return null;
  return raw;
}

/** Where to send the user immediately after a successful sign-in. */
export async function resolvePostLoginPath(
  supabase: SupabaseClient,
  next?: string | null,
): Promise<string> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const gate = await getSubscriptionGateContext(supabase, user.id);
    if (gate.needsPaywall) return PATH_ACTIVATE_SUBSCRIPTION;
  }

  return safePostLoginNextPath(next) ?? PATH_APP_ENTRY;
}
