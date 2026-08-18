/**
 * Finsepa plan tiers.
 * Pro = unlimited product surface; Free = hard product caps.
 * `trial` is unused (legacy API); new users start on Free.
 *
 * Free portfolio surface: 1 **manual** portfolio, no brokerage connect/sync.
 * Brokerage is Pro only (connection + resync).
 */
export type PlanTier = "pro" | "trial" | "free";

export const FREE_MAX_REAL_PORTFOLIOS = 1;
export const FREE_MAX_WATCHLISTS = 1;

export type PlanEntitlements = {
  tier: PlanTier;
  /** Paid Pro (Stripe active/trialing). */
  isPro: boolean;
  /** @deprecated Platform trial retired; always false for new resolution. */
  isTrial: boolean;
  /** Free limited plan. */
  isFree: boolean;
  /** Days left in platform trial (top bar). */
  topbarTrialDaysLeft: number | null;
  /**
   * Free: max **manual** (non-brokerage) real portfolios.
   * Brokerage books do not use this slot — they freeze unless Pro.
   * `null` = unlimited (Pro).
   */
  maxRealPortfolios: number | null;
  maxWatchlists: number | null;
  canUseAgent: boolean;
  canPublishPublicPortfolio: boolean;
  canCreateCombinedPortfolio: boolean;
  canCreatePortfolio: boolean;
  canCreateWatchlist: boolean;
  /** Connect / reconnect / sync brokerage (SnapTrade). Free = false. */
  canConnectBrokerage: boolean;
  /**
   * Activity alerts (earnings results + superinvestor 13F activity).
   * Pro only — Free can follow but does not receive new push/inbox items.
   */
  canUseActivityAlerts: boolean;
};

export function entitlementsForTier(
  tier: PlanTier,
  _topbarTrialDaysLeft: number | null = null,
): PlanEntitlements {
  const resolved: PlanTier = tier === "pro" ? "pro" : "free";
  const isPro = resolved === "pro";
  const unlimited = isPro;

  return {
    tier: resolved,
    isPro,
    isTrial: false,
    isFree: !isPro,
    topbarTrialDaysLeft: null,
    maxRealPortfolios: unlimited ? null : FREE_MAX_REAL_PORTFOLIOS,
    maxWatchlists: unlimited ? null : FREE_MAX_WATCHLISTS,
    canUseAgent: unlimited,
    canPublishPublicPortfolio: unlimited,
    canCreateCombinedPortfolio: unlimited,
    canCreatePortfolio: unlimited,
    canCreateWatchlist: unlimited,
    canConnectBrokerage: unlimited,
    canUseActivityAlerts: unlimited,
  };
}

/** Pro never hard-paywalled; Free keeps app access. Hard paywall removed. */
export function needsHardPaywall(_tier: PlanTier): boolean {
  return false;
}
