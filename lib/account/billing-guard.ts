/**
 * Server-side rules for whether a Finsepa user may start a new Pro checkout.
 * One Supabase user maps to one email; this blocks duplicate paid subs for that user.
 */
export function hasActivePaidProSubscription(
  row: { plan_code?: string | null; status?: string | null } | null | undefined,
): boolean {
  const code = row?.plan_code;
  if (!code || typeof code !== "string" || !code.startsWith("pro_")) return false;
  const status = row?.status;
  return status === "active" || status === "trialing";
}
