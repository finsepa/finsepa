export type StockPerformance = {
  ticker: string;
  price: number | null;
  d1: number | null;
  d5: number | null;
  /** ~7 trading days back vs prior close */
  d7: number | null;
  m1: number | null;
  m6: number | null;
  ytd: number | null;
  y1: number | null;
  y5: number | null;
  all: number | null;
};
