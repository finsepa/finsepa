/**
 * Server-side rules for whether a Finsepa user may start a new Pro checkout.
 * One Supabase user maps to one email; this blocks duplicate paid subs for that user.
 * Keep in sync with `/api/account/billing/summary` (`pro_`* and legacy `pro`).
 */
export function hasActivePaidProSubscription(
  row: { plan_code?: string | null; status?: string | null } | null | undefined,
): boolean {
  const code = row?.plan_code;
  if (!code || typeof code !== "string") return false;
  const isProPlan = code.startsWith("pro_") || code === "pro";
  if (!isProPlan) return false;
  const status = row?.status;
  return status === "active" || status === "trialing";
}
