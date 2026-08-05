import "server-only";

import { getSubscriptionGateContext } from "@/lib/account/subscription-gate";
import type { SupabaseClient } from "@supabase/supabase-js";

export const BROKERAGE_PRO_REQUIRED_CODE = "BROKERAGE_PRO_REQUIRED" as const;

/**
 * Free users cannot open SnapTrade portal, connect, or sync.
 * Returns a JSON-serializable error payload when blocked; `null` when allowed.
 */
export async function brokerageProRequiredError(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ error: string; code: typeof BROKERAGE_PRO_REQUIRED_CODE } | null> {
  const gate = await getSubscriptionGateContext(supabase, userId);
  if (gate.canConnectBrokerage) return null;
  return {
    error: "Brokerage connection is available on Pro. Upgrade to connect or sync a brokerage.",
    code: BROKERAGE_PRO_REQUIRED_CODE,
  };
}
