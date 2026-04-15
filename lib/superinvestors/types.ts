export type InstitutionalHoldingRow = {
  issuer: string;
  titleOfClass: string | null;
  /** Position value in USD (not thousands). */
  valueUsd: number;
  /** Percent of total reported 13F value. */
  pct: number;
};

export type InstitutionalHoldingsPayload = {
  filerDisplayName: string;
  cik: string;
  /** Filing period end (report date) when available. */
  reportDate: string | null;
  /** SEC filing acceptance date. */
  filingDate: string | null;
  accessionNumber: string | null;
  totalValueUsd: number;
  positionCount: number;
  holdings: InstitutionalHoldingRow[];
  source: "edgar" | "fixture";
};

/** 13F position vs prior filing (current row only; sold-out names use `Berkshire13fSoldOutRow`). */
export type Holding13fComparisonStatus = "new" | "add" | "reduce" | "unchanged";

export type Berkshire13fFilingMeta = {
  accessionNumber: string | null;
  filingDate: string | null;
  reportDate: string | null;
};

export type Berkshire13fComparisonRow = {
  companyName: string;
  cusip: string | null;
  ticker: string | null;
  shares: number | null;
  valueUsd: number;
  /** Percent of current filing total value (0–100). */
  weight: number;
  previousShares: number | null;
  sharesDelta: number | null;
  /** vs prior shares: ((current − prior) / prior) × 100; null if new, missing shares, or prior shares were 0. */
  sharesChangePct: number | null;
  status: Holding13fComparisonStatus | null;
};

export type Berkshire13fSoldOutRow = {
  companyName: string;
  cusip: string | null;
  ticker: string | null;
  previousShares: number | null;
  previousValueUsd: number;
};

export type Berkshire13fComparisonPayload = {
  filerDisplayName: string;
  cik: string;
  current: Berkshire13fFilingMeta;
  previous: Berkshire13fFilingMeta | null;
  /** False when only one 13F-HR exists in the submissions feed (no delta / sold-out semantics). */
  hasPriorFiling: boolean;
  totalValueUsd: number;
  previousTotalValueUsd: number | null;
  positionCount: number;
  rows: Berkshire13fComparisonRow[];
  soldOut: Berkshire13fSoldOutRow[];
  source: "edgar" | "fixture";
};
