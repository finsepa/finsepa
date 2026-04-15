/** Stock asset page — Earnings tab (client + API JSON). */

export type StockEarningsReportTiming = "bmo" | "amc" | "unknown";

export type StockEarningsUpcoming = {
  reportDateDisplay: string | null;
  reportDateYmd: string | null;
  timing: StockEarningsReportTiming;
  /** Short label e.g. BMO / AMC — empty when unknown. */
  timingShortLabel: string;
  /** Phrase for card e.g. "Before market" — empty when unknown. */
  timingPhrase: string;
  fiscalPeriodLabel: string | null;
  epsEstimateDisplay: string | null;
  revenueEstimateDisplay: string | null;
};

export type StockEarningsHistoryRow = {
  fiscalPeriodEndYmd: string | null;
  fiscalPeriodLabel: string | null;
  reportDateDisplay: string | null;
  epsEstimateDisplay: string | null;
  epsActualDisplay: string | null;
  surprisePct: number | null;
  surpriseDisplay: string | null;
  revenueEstimateDisplay: string | null;
  revenueActualDisplay: string | null;
  reported: boolean;
  /** Raw values for Estimates chart (USD for revenue). */
  revenueEstimateUsd: number | null;
  revenueActualUsd: number | null;
  epsEstimateRaw: number | null;
  epsActualRaw: number | null;
};

/** One category on the Estimates bar chart (annual year or fiscal quarter). */
export type StockEarningsEstimatesPoint = {
  sortKey: string;
  label: string;
  revenueEstimateUsd: number | null;
  revenueActualUsd: number | null;
  epsEstimate: number | null;
  epsActual: number | null;
  /** Fiscal period ended on/before today (UTC) — actuals may still be null if missing from source. */
  reported: boolean;
};

export type StockEarningsEstimatesChart = {
  quarterly: StockEarningsEstimatesPoint[];
  annual: StockEarningsEstimatesPoint[];
};

export type StockEarningsTabPayload = {
  ticker: string;
  upcoming: StockEarningsUpcoming | null;
  history: StockEarningsHistoryRow[];
  estimatesChart: StockEarningsEstimatesChart | null;
};
