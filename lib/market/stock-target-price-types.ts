/** One bucket for the analyst distribution bar chart (fixed display order). */
export type StockAnalystDistributionBucket = {
  label: string;
  count: number;
};

/** Analyst / consensus price targets — shared by API route and client tab. */
export type StockTargetPricePayload = {
  consensusTarget: number | null;
  wallStreetTarget: number | null;
  meanTarget: number | null;
  highTarget: number | null;
  lowTarget: number | null;
  fairValue: number | null;
  consensusLabel: string | null;
  /** Legacy one-line summary; prefer {@link analystDistribution} in UI. */
  distributionSummary: string | null;
  /** Strong buy → strong sell, for horizontal bar rows. */
  analystDistribution: StockAnalystDistributionBucket[];
};
