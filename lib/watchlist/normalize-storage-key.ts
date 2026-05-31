import { toSupportedCryptoTicker } from "@/lib/market/crypto-meta";

import { cryptoWatchlistKey, WATCHLIST_CRYPTO_PREFIX, WATCHLIST_INDEX_PREFIX } from "./constants";

/** Canonical `watchlist.ticker` value (e.g. AAPL, CRYPTO:ARB, INDEX:GSPC.INDX). */
export function normalizeWatchlistStorageKey(raw: string): string {
  const t = raw.trim().toUpperCase();
  if (!t) return t;

  if (t.startsWith(WATCHLIST_INDEX_PREFIX)) return t;

  if (t.startsWith(WATCHLIST_CRYPTO_PREFIX)) {
    const sym = t.slice(WATCHLIST_CRYPTO_PREFIX.length);
    const base = toSupportedCryptoTicker(sym);
    return base ? cryptoWatchlistKey(base) : t;
  }

  const cryptoBase = toSupportedCryptoTicker(t);
  if (cryptoBase) return cryptoWatchlistKey(cryptoBase);

  return t;
}

/**
 * Legacy rows may use bare pairs (`ARB-USD`) or unprefixed symbols. Try all plausible keys on DELETE.
 */
export function watchlistRemovalCandidateKeys(raw: string): string[] {
  const canonical = normalizeWatchlistStorageKey(raw);
  const out = new Set<string>([raw.trim().toUpperCase(), canonical]);

  const cryptoBase = canonical.startsWith(WATCHLIST_CRYPTO_PREFIX)
    ? canonical.slice(WATCHLIST_CRYPTO_PREFIX.length)
    : toSupportedCryptoTicker(raw);

  if (cryptoBase) {
    out.add(cryptoWatchlistKey(cryptoBase));
    out.add(`${cryptoBase}-USD`);
    out.add(`${cryptoBase}-USDT`);
    out.add(cryptoBase);
    out.add(`${WATCHLIST_CRYPTO_PREFIX}${cryptoBase}-USD`);
  }

  return [...out];
}

/** All storage keys that should count as the same watchlist asset. */
export function watchlistWatchedAliasKeys(raw: string): string[] {
  return watchlistRemovalCandidateKeys(raw);
}

export function isWatchlistTickerWatched(watched: ReadonlySet<string>, storageKey: string): boolean {
  const targets = new Set(watchlistWatchedAliasKeys(storageKey).map(normalizeWatchlistStorageKey));
  for (const w of watched) {
    if (targets.has(normalizeWatchlistStorageKey(w))) return true;
  }
  return false;
}

export function addWatchlistTickerToSet(watched: ReadonlySet<string>, storageKey: string): Set<string> {
  const next = new Set(watched);
  next.add(normalizeWatchlistStorageKey(storageKey));
  return next;
}

export function removeWatchlistTickerFromSet(watched: ReadonlySet<string>, storageKey: string): Set<string> {
  const drop = new Set(watchlistWatchedAliasKeys(storageKey).map(normalizeWatchlistStorageKey));
  return new Set([...watched].filter((k) => !drop.has(normalizeWatchlistStorageKey(k))));
}
