/**
 * EODHD CC bases not present in {@link ALL_CRYPTO_METAS} but used in search / import.
 * Pair-shaped imports (`BASE-USD`) do not need entries here; plain-base rows do.
 */
export const CRYPTO_CC_EXTRA_PLAIN_BASES = new Set<string>(["FLOKI"]);
