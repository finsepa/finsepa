/**
 * Finsepa plan tiers after platform trial.
 * Pro/trial = unlimited product surface; Free = hard product caps.
 *
 * Free portfolio surface: 1 **manual** portfolio, no brokerage connect/sync.
 * Brokerage is Pro/trial only (connection + resync).
 */
export type PlanTier = "pro" | "trial" | "free";

export const FREE_MAX_REAL_PORTFOLIOS = 1;
export const FREE_MAX_WATCHLISTS = 1;

export type PlanEntitlements = {
  tier: PlanTier;
  /** Paid Pro (Stripe active/trialing). */
  isPro: boolean;
  /** Platform trial still running. */
  isTrial: boolean;
  /** Post-trial free limited plan. */
  isFree: boolean;
  /** Days left in platform trial (top bar). */
  topbarTrialDaysLeft: number | null;
  /**
   * Free: max **manual** (non-brokerage) real portfolios.
   * Brokerage books do not use this slot — they freeze unless Pro/trial.
   * `null` = unlimited (Pro/trial).
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
   * Activity alerts (earning results now; superinvestor / public portfolio later).
   * Pro + Trial only — Free can follow but does not receive new push/inbox items.
   */
  canUseActivityAlerts: boolean;
};

export function entitlementsForTier(
  tier: PlanTier,
  topbarTrialDaysLeft: number | null = null,
): PlanEntitlements {
  const isPro = tier === "pro";
  const isTrial = tier === "trial";
  const isFree = tier === "free";
  const unlimited = isPro || isTrial;

  return {
    tier,
    isPro,
    isTrial,
    isFree,
    topbarTrialDaysLeft: isTrial ? topbarTrialDaysLeft : null,
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

/** Pro never hard-paywalled; Free/Trial keep app access. Hard paywall removed. */
export function needsHardPaywall(_tier: PlanTier): boolean {
  return false;
}
