export type ImportOperationLabel =
  | "Cash In"
  | "Cash Out"
  | "Other income"
  | "Other expense"
  | "Buy"
  | "Sell"
  /** Snowball / broker: cash from dividend; `shares` on draft = total USD received. */
  | "Dividend"
  /** Stock split / consolidation; `price` = ratio (new shares per 1 old share). */
  | "Split";

export type ImportFieldKey = "asset" | "operation" | "date" | "price" | "shares" | "fee" | "total";

/** One row after parsing the spreadsheet (before user edits). */
export type ImportedTransactionDraft = {
  /** Original row index in sheet (1-based data rows) for debugging */
  sourceRow: number;
  asset: string;
  /** When set, used for quotes/logos; `asset` is the label shown in the import grid. */
  quoteSymbol?: string;
  operation: ImportOperationLabel | null;
  dateYmd: string | null;
  price: number | null;
  shares: number | null;
  fee: number | null;
  sum: number | null;
  /** Fields we could not map or parse — show red + allow edit */
  missing: ImportFieldKey[];
};
