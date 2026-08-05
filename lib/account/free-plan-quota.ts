/**
 * Counts Free-quota portfolios.
 * Free active slot = 1 **manual** portfolio (demo/combined/brokerage excluded from the count).
 * Brokerage includes offline Free freezes ({@link PortfolioSnaptradeLink.offline}).
 */

export function isBrokerageLinkedPortfolio(p: {
  snaptrade?: unknown;
}): boolean {
  return p.snaptrade != null && typeof p.snaptrade === "object";
}

/** Real non-demo, non-combined book (manual or brokerage). */
export function isRealPortfolioForFreeQuota(p: {
  kind?: string | null;
  isDemo?: boolean | null;
}): boolean {
  if (p.isDemo === true) return false;
  if (p.kind === "combined") return false;
  if (p.kind === "demo") return false;
  return true;
}

/** Manual Free portfolio slot (brokerage never fills this free quota). */
export function isManualPortfolioForFreeQuota(p: {
  kind?: string | null;
  isDemo?: boolean | null;
  snaptrade?: unknown;
}): boolean {
  return isRealPortfolioForFreeQuota(p) && !isBrokerageLinkedPortfolio(p);
}

export function countManualPortfoliosForFreeQuota(
  portfolios: readonly { kind?: string | null; isDemo?: boolean | null; snaptrade?: unknown }[],
): number {
  return portfolios.filter(isManualPortfolioForFreeQuota).length;
}

/** @deprecated Prefer {@link countManualPortfoliosForFreeQuota} for Free limits. */
export function countRealPortfoliosForFreeQuota(
  portfolios: readonly { kind?: string | null; isDemo?: boolean | null; snaptrade?: unknown }[],
): number {
  return countManualPortfoliosForFreeQuota(portfolios);
}

export function freePortfolioQuotaExceeded(
  portfolios: readonly { kind?: string | null; isDemo?: boolean | null; snaptrade?: unknown }[],
  maxReal: number | null,
): boolean {
  if (maxReal == null) return false;
  return countManualPortfoliosForFreeQuota(portfolios) > maxReal;
}

export function freePortfolioAtCap(
  portfolios: readonly { kind?: string | null; isDemo?: boolean | null; snaptrade?: unknown }[],
  maxReal: number | null,
): boolean {
  if (maxReal == null) return false;
  return countManualPortfoliosForFreeQuota(portfolios) >= maxReal;
}

export function countBrokeragePortfolios(
  portfolios: readonly { kind?: string | null; isDemo?: boolean | null; snaptrade?: unknown }[],
): number {
  return portfolios.filter(
    (p) => isRealPortfolioForFreeQuota(p) && isBrokerageLinkedPortfolio(p),
  ).length;
}
