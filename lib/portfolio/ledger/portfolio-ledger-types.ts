/** Shared types for Manual Portfolio ledger validation / replay (Phase 1). */

export type PortfolioLedgerErrorCode =
  | "SELL_WITHOUT_POSITION"
  | "SELL_EXCEEDS_AVAILABLE_SHARES"
  | "INVALID_QUANTITY"
  | "INVALID_PRICE"
  | "INVALID_FEE"
  | "INVALID_TRANSACTION_ORDER"
  | "DUPLICATE_TRANSACTION_ID"
  | "DUPLICATE_PORTFOLIO_ID"
  | "INVALID_NUMERIC"
  | "MISSING_FIELDS"
  | "UNKNOWN_TRANSACTION_KIND"
  | "INVALID_SPLIT";

export type PortfolioLedgerIssue = {
  code: PortfolioLedgerErrorCode;
  portfolioId: string;
  transactionId: string | null;
  message: string;
  /** True when the issue is on a legacy-tagged anomaly (load/display allowed). */
  legacy?: boolean;
};

export type PortfolioLedgerValidationResult = {
  ok: boolean;
  errors: PortfolioLedgerIssue[];
  warnings: PortfolioLedgerIssue[];
};
