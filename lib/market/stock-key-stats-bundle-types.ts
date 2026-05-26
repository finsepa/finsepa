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

/** True when at least one section has rows — empty SSR shells should trigger a client refetch. */
export function stockKeyStatsBundleHasContent(bundle: StockKeyStatsBundle | null | undefined): boolean {
  if (!bundle) return false;
  return (
    (bundle.basic?.length ?? 0) > 0 ||
    (bundle.valuation?.length ?? 0) > 0 ||
    (bundle.revenueProfit?.length ?? 0) > 0 ||
    (bundle.margins?.length ?? 0) > 0 ||
    (bundle.growth?.length ?? 0) > 0 ||
    (bundle.assetsLiabilities?.length ?? 0) > 0 ||
    (bundle.returns?.length ?? 0) > 0 ||
    (bundle.dividends?.length ?? 0) > 0 ||
    (bundle.risk?.length ?? 0) > 0
  );
}
