export type PortfolioDividendEventStatus = "declared" | "estimated";

export type PortfolioDividendScheduleRow = {
  symbol: string;
  /** Cash payment / dividend date (yyyy-MM-dd). */
  paymentDate: string;
  /** Kept for clients that still show ex-date; prefer `paymentDate` in UI. */
  exDividendDate: string | null;
  /** Kept for older clients; web UI treats all rows as a single dividend amount. */
  status: PortfolioDividendEventStatus;
  totalUsd: number;
  perShareUsd: number;
  shares: number;
  frequencyLabel: string | null;
  growthPct: number | null;
  yieldPct: number | null;
};

export type PortfolioDividendScheduleMonth = {
  monthKey: string;
  label: string;
  totalUsd: number;
  rows: PortfolioDividendScheduleRow[];
};

/** Shared fetch covers prior calendar year → next year (estimates). */
export type PortfolioDividendsYearBounds = {
  minYear: number;
  maxYear: number;
  currentYear: number;
};

export type PortfolioDividendsSchedulePayload = {
  months: PortfolioDividendScheduleMonth[];
  yearBounds: PortfolioDividendsYearBounds;
};
