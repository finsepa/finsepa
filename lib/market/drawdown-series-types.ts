export type DrawdownSeriesPoint = {
  date: string;
  /** Unix seconds (UTC midnight of `date`). */
  timestamp: number;
  /** Drawdown from running peak as a negative fraction (0 at peaks, e.g. -0.6634 = −66.34%). */
  drawdown: number;
};
