/** Major FX crosses for Screener → Currencies (EODHD `*.FOREX`). Client-safe. */

export type CurrencyPairMeta = {
  /** Full display name, e.g. "Euro / USD". */
  name: string;
  /** EODHD symbol, e.g. EURUSD.FOREX. */
  symbol: string;
  /** Short pair code for UI, e.g. EURUSD. */
  code: string;
};

/** Order matches common “major FX crosses” lists (USD majors). */
export const SCREENER_CURRENCY_MAJORS: readonly CurrencyPairMeta[] = [
  { name: "New Zealand Dollar / USD", symbol: "NZDUSD.FOREX", code: "NZDUSD" },
  { name: "British Pound / USD", symbol: "GBPUSD.FOREX", code: "GBPUSD" },
  { name: "Australian Dollar / USD", symbol: "AUDUSD.FOREX", code: "AUDUSD" },
  { name: "Euro / USD", symbol: "EURUSD.FOREX", code: "EURUSD" },
  { name: "USD / Canadian Dollar", symbol: "USDCAD.FOREX", code: "USDCAD" },
  { name: "USD / Japanese Yen", symbol: "USDJPY.FOREX", code: "USDJPY" },
];

export const SCREENER_CURRENCY_SYMBOLS: readonly string[] = SCREENER_CURRENCY_MAJORS.map((p) => p.symbol);

export type CurrencyTableRow = {
  name: string;
  symbol: string;
  code: string;
  value: number;
  change1D: number;
  change1M: number | null;
  changeYTD: number | null;
};
