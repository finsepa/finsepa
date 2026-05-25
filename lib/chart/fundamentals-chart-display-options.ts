/** Overlay toggles for fundamentals bar/line charts (Key Stats modal, Multicharts). */
export type FundamentalsChartDisplayOptions = {
  showAvgLine: boolean;
  showMaxLine: boolean;
  showMinLine: boolean;
  /** Value labels above bars (Charting bar mode). */
  showBarValues: boolean;
};

export const DEFAULT_FUNDAMENTALS_CHART_DISPLAY_OPTIONS: FundamentalsChartDisplayOptions = {
  showAvgLine: false,
  showMaxLine: false,
  showMinLine: false,
  showBarValues: false,
};
