export const PERIOD_RETURN_GRANULARITIES = ["weekly", "monthly", "quarterly", "annually"] as const;
export type PeriodReturnGranularity = (typeof PERIOD_RETURN_GRANULARITIES)[number];

export type PortfolioPeriodReturnBar = {
  /** Short label for the X axis */
  label: string;
  /** Inclusive period start (yyyy-MM-dd) */
  periodStart: string;
  /** Inclusive period end (yyyy-MM-dd) */
  periodEnd: string;
  /** Total return % for the portfolio over the period (approx.; ignores intra-period timing of flows). */
  portfolioPct: number | null;
  /** Same window total return % for the benchmark. */
  benchmarkPct: number | null;
};
