/** Dual-column stock header during US pre-market / after-hours. */
export type StockExtendedHoursHeader = {
  session: "pre" | "post";
  closePrice: number;
  closeChangeAbs: number | null;
  closeChangePct: number | null;
  closeTimestampLabel: string;
  extendedPrice: number;
  extendedChangeAbs: number;
  extendedChangePct: number;
  /** Unix seconds — last extended-hours trade time from the provider. */
  extendedTimeUnix: number;
  extendedTimestampLabel: string;
};
