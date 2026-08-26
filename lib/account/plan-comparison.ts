/**
 * Free vs Pro feature bullets for `/account/plans` (Linear-style, no duplication).
 * Free lists the full included surface; Pro lists “All Free features +” then upgrades only.
 * Limits must stay aligned with {@link lib/account/plan-entitlements}.
 */

export const FREE_PLAN_CARD_FEATURES = [
  "Demo + 1 manual portfolio",
  "1 watchlist",
  "Up to 15 holdings",
  "30+ years of financial data",
  "Stocks, crypto, ETF, indices, currencies",
  "Earnings calendar",
  "Economy calendar",
  "Historical macro data",
  "Superinvestors data",
  "Insiders data",
] as const;

/** Pro-only additions / upgrades (Linear: “All Free features + …”). */
export const PRO_PLAN_CARD_FEATURES = [
  "All Free features +",
  "Unlimited portfolios",
  "Unlimited watchlists",
  "Unlimited holdings",
  "Brokerage connection",
  "Combined portfolios",
  "AI Agent",
  "Public shareable portfolios",
  "Activities alerts",
  "Priority support",
] as const;
