/**
 * Free vs Pro feature bullets for `/account/plans` (Linear-style, no duplication).
 * Free: Free-tier limits only. Pro: Pro-only upgrades.
 * Limits must stay aligned with {@link lib/account/plan-entitlements}.
 */

export const FREE_PLAN_CARD_FEATURES = [
  "1 manual portfolio",
  "1 watchlist",
  "Up to 15 holdings",
] as const;

/** Pro-only upgrades. */
export const PRO_PLAN_CARD_FEATURES = [
  "Unlimited portfolios",
  "Unlimited watchlists",
  "Unlimited holdings",
  "Brokerage connections",
  "Combined portfolios",
  "Public shareable portfolios",
  "Portfolio insights and dividends",
  "Activities alerts",
  "Priority support",
] as const;
