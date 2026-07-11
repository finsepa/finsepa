/** Overlay toggles for fundamentals bar/line charts (Key Stats modal, Multicharts). */
export type FundamentalsChartDisplayOptions = {
  showAvgLine: boolean;
  showMaxLine: boolean;
  showMinLine: boolean;
  /** Value labels on bars and line charts (Key Stats modal, Multicharts, Charting). */
  showBarValues: boolean;
};

export const DEFAULT_FUNDAMENTALS_CHART_DISPLAY_OPTIONS: FundamentalsChartDisplayOptions = {
  showAvgLine: false,
  showMaxLine: false,
  showMinLine: false,
  showBarValues: false,
};
