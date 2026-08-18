import "server-only";

import { getSubscriptionGateContext } from "@/lib/account/subscription-gate";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export type AgentAccessResult =
  | { ok: true }
  | { ok: false; code: "PAYWALL" | "UNAUTHENTICATED" | "FREE_PLAN"; message: string };

/** Agent is Pro only — not Free plan. */
export async function assertAgentEntitlement(userId: string): Promise<AgentAccessResult> {
  const supabase = await getSupabaseServerClient();
  const gate = await getSubscriptionGateContext(supabase, userId);
  if (gate.canUseAgent) {
    return { ok: true };
  }
  return {
    ok: false,
    code: "FREE_PLAN",
    message: "Upgrade to Finsepa Pro to use Finsepa Agent.",
  };
}
