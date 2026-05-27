/** Supabase `market_snapshot.key` for a US equity detail page bundle. */
export function assetSnapshotKey(ticker: string): string {
  const sym = ticker.trim().toUpperCase();
  return sym ? `asset_${sym}` : "";
}

export function tickerFromAssetSnapshotKey(key: string): string | null {
  const k = key.trim();
  if (!k.startsWith("asset_")) return null;
  const sym = k.slice("asset_".length).trim().toUpperCase();
  return sym || null;
}
