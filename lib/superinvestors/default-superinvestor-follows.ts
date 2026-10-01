/**
 * Default Following list for new signups / first-time guests.
 * Keep in sync with iOS `InvestorsMapping.defaultNewUserFollowSlugs`.
 */
export const DEFAULT_SUPERINVESTOR_FOLLOW_PATHS = [
  "/superinvestors/bill-ackman",
  "/superinvestors/berkshire-hathaway",
] as const;

export function defaultSuperinvestorFollowPaths(): string[] {
  return [...DEFAULT_SUPERINVESTOR_FOLLOW_PATHS];
}
