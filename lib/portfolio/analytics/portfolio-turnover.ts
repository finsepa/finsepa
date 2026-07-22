/**
 * Portfolio turnover from ledger trades (trailing 12 months).
 *
 * Turnover = min(total purchases $, total sales $) / average equity market value
 * Deposits, withdrawals, dividends, fees excluded.
 */

import type { PortfolioHolding, PortfolioTransaction } from "@/components/portfolio/portfolio-types";
import { sortPortfolioTransactionsCanonical } from "@/lib/portfolio/ledger/portfolio-ledger-order";
import { migratePortfolioTransactionSequences } from "@/lib/portfolio/ledger/portfolio-ledger-migrate";
import {
  ANALYTICS_PERIOD_1Y,
  availableMetric,
  unavailableMetric,
  type AnalyticsMetricResult,
} from "@/lib/portfolio/analytics/portfolio-analytics-types";
import { equityMarketValue } from "@/lib/portfolio/overview-metrics";

function ymdDaysAgo(asOfYmd: string, days: number): string {
  const t = Date.parse(`${asOfYmd}T12:00:00.000Z`);
  if (!Number.isFinite(t)) return asOfYmd;
  const d = new Date(t - days * 86_400_000);
  return d.toISOString().slice(0, 10);
}

/**
 * @param averageEquityUsd average portfolio equity MV over the period (caller may pass
 * current equity as approximation when historical average is unavailable).
 */
export function computePortfolioTurnover(args: {
  transactions: readonly PortfolioTransaction[];
  averageEquityUsd: number;
  asOfYmd: string;
  lookbackDays?: number;
}): AnalyticsMetricResult {
  const lookback = args.lookbackDays ?? 365;
  const start = ymdDaysAgo(args.asOfYmd, lookback);
  const { transactions: migrated } = migratePortfolioTransactionSequences(args.transactions);
  const ordered = sortPortfolioTransactionsCanonical(migrated);

  let buys = 0;
  let sells = 0;
  for (const t of ordered) {
    if (t.kind !== "trade") continue;
    if (t.date < start || t.date > args.asOfYmd) continue;
    const op = t.operation.toLowerCase();
    const notional = Math.abs(t.sum);
    if (!Number.isFinite(notional) || notional <= 0) continue;
    if (op === "buy") buys += notional;
    else if (op === "sell") sells += notional;
  }

  const observations = (buys > 0 ? 1 : 0) + (sells > 0 ? 1 : 0);
  if (args.averageEquityUsd <= 1e-6) {
    if (buys === 0 && sells === 0) {
      return availableMetric(0, {
        observations: 0,
        period: ANALYTICS_PERIOD_1Y,
        asOf: args.asOfYmd,
        coverage: 1,
      });
    }
    return unavailableMetric("ZERO_DENOMINATOR", {
      observations,
      period: ANALYTICS_PERIOD_1Y,
      asOf: args.asOfYmd,
    });
  }

  const turnover = (Math.min(buys, sells) / args.averageEquityUsd) * 100;
  if (!Number.isFinite(turnover)) {
    return unavailableMetric("INVALID_INPUT", { asOf: args.asOfYmd });
  }
  return availableMetric(turnover, {
    observations: ordered.filter((t) => t.kind === "trade" && t.date >= start && t.date <= args.asOfYmd)
      .length,
    period: ANALYTICS_PERIOD_1Y,
    asOf: args.asOfYmd,
    coverage: 1,
  });
}

export function turnoverAverageEquityFromHoldings(holdings: PortfolioHolding[]): number {
  return equityMarketValue(holdings);
}
