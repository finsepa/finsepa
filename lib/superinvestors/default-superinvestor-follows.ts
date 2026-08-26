/** Default Following list for new signups / first-time guests. */
export const DEFAULT_SUPERINVESTOR_FOLLOW_PATHS = [
  "/superinvestors/berkshire-hathaway",
  "/superinvestors/terry-smith",
] as const;

export function defaultSuperinvestorFollowPaths(): string[] {
  return [...DEFAULT_SUPERINVESTOR_FOLLOW_PATHS];
}
