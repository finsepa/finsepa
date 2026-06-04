export type InstitutionalHoldingRow = {
  issuer: string;
  titleOfClass: string | null;
  /** Resolved listing symbol when CUSIP / issuer mapping succeeds (13F has no tickers). */
  ticker: string | null;
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
  /** `unavailable` when SEC data could not be loaded (no fixture for this filer). */
  source: "edgar" | "fixture" | "unavailable";
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
  source: "edgar" | "fixture" | "unavailable";
};

export type SuperinvestorQuarterlyTransactionKind = "buy" | "sell" | "new" | "exit";

export type SuperinvestorQuarterlyTransaction = {
  kind: SuperinvestorQuarterlyTransactionKind;
  companyName: string;
  ticker: string | null;
  cusip: string | null;
  /** Human label, e.g. `Q4 2025`. */
  quarterLabel: string;
  /** 13F report period end (ISO date). */
  reportDate: string;
  sharesChangePct: number | null;
  sharesDelta: number | null;
  avgClosingPriceUsd: number | null;
  priceRangeLowUsd: number | null;
  priceRangeHighUsd: number | null;
  /** Change in portfolio weight (percentage points), e.g. +2.4 or −29.3. */
  portfolioWeightChangePct: number | null;
};

export type SuperinvestorQuarterTransactionGroup = {
  quarterLabel: string;
  reportDate: string;
  /** SEC acceptance date for the newer filing in this pair (unique per amendment). */
  filingDate: string | null;
  transactions: SuperinvestorQuarterlyTransaction[];
};

export type SuperinvestorTransactionsPayload = {
  filerDisplayName: string;
  cik: string;
  /** Quarters newest-first; each lists position changes vs the prior filing. */
  quarters: SuperinvestorQuarterTransactionGroup[];
  source: "edgar" | "fixture" | "unavailable";
};

/** Superinvestor profile SSR bundle stored in `market_snapshot`. */
export type Superinvestor13fProfilePageData = {
  comparison: Berkshire13fComparisonPayload;
  transactions: SuperinvestorTransactionsPayload;
};
