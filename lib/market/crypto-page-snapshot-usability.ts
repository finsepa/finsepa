type CryptoPageSnapshotLike = {
  routeSymbol?: string | null;
  asset?: { price?: number | null } | null;
  performance?: { price?: number | null } | null;
};

function hasPositivePrice(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n) && n > 0;
}

/** Chart-only rows with null asset/price blocked EOD refetch (e.g. prod `asset_crypto_XRP`).
 * Enforced on read ({@link readCryptoPageSnapshot}), write ({@link upsertCryptoPageSnapshot}),
 * and cold-miss single-flight ({@link loadCryptoPageInitialData}). */
export function isUsableCryptoPageSnapshot(
  payload: CryptoPageSnapshotLike | null | undefined,
): payload is CryptoPageSnapshotLike {
  if (!payload?.routeSymbol?.trim()) return false;
  if (hasPositivePrice(payload.asset?.price)) return true;
  if (hasPositivePrice(payload.performance?.price)) return true;
  return false;
}
