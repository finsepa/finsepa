/** Supabase `market_snapshot.key` for shared Key Indicators blob. */
export function stockKeyIndicatorsSnapshotKey(ticker: string): string {
  const sym = ticker.trim().toUpperCase();
  return sym ? `key_indicators_${sym}` : "";
}
