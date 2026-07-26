import "server-only";

import { getSubscriptionGateContext } from "@/lib/account/subscription-gate";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export type AgentAccessResult =
  | { ok: true }
  | { ok: false; code: "PAYWALL" | "UNAUTHENTICATED"; message: string };

/** Agent is available to any user who can use the main app (Pro or active platform trial). */
export async function assertAgentEntitlement(userId: string): Promise<AgentAccessResult> {
  const supabase = await getSupabaseServerClient();
  const gate = await getSubscriptionGateContext(supabase, userId);
  if (gate.needsPaywall) {
    return {
      ok: false,
      code: "PAYWALL",
      message: "Activate your subscription to use Finsepa Agent.",
    };
  }
  return { ok: true };
}
