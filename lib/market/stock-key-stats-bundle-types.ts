export type KeyStatsRow = { label: string; value: string };

export type StockKeyStatsBundle = {
  basic: KeyStatsRow[] | null;
  valuation: KeyStatsRow[] | null;
  revenueProfit: KeyStatsRow[] | null;
  margins: KeyStatsRow[] | null;
  growth: KeyStatsRow[] | null;
  assetsLiabilities: KeyStatsRow[] | null;
  returns: KeyStatsRow[] | null;
  dividends: KeyStatsRow[] | null;
  risk: KeyStatsRow[] | null;
};
