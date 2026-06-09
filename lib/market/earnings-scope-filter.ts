import { WATCHLIST_CRYPTO_PREFIX, WATCHLIST_INDEX_PREFIX } from "@/lib/watchlist/constants";
import { watchlistWatchedAliasKeys } from "@/lib/watchlist/normalize-storage-key";

import type {
  EarningsCalendarItem,
  EarningsDayColumn,
  EarningsTimingBucket,
  EarningsWeekPayload,
} from "./earnings-calendar-types";

export type EarningsScopeFilter = "all" | "watchlist" | "holdings";

export function parseEarningsScopeFilter(raw: string | null | undefined): EarningsScopeFilter {
  if (raw === "watchlist" || raw === "holdings") return raw;
  return "all";
}

/** Align with server `earningsUniverseKey`. */
export function earningsScopeKey(ticker: string): string {
  return ticker
    .trim()
    .toUpperCase()
    .replace(/\.US$/i, "")
    .replace(/-/g, ".");
}

/** Collapse share classes for scope matching (e.g. BRK.A / BRK.B → BRK). */
export function canonicalEarningsScopeKey(ticker: string): string {
  const t = earningsScopeKey(ticker);
  const m = /^([A-Z]{1,10})\.([A-Z0-9]{1,3})$/.exec(t);
  if (m) return m[1]!;
  return t;
}

export function earningsItemMatchesScope(
  item: Pick<EarningsCalendarItem, "ticker">,
  allowedCanonicalKeys: ReadonlySet<string>,
): boolean {
  return allowedCanonicalKeys.has(canonicalEarningsScopeKey(item.ticker));
}

export function buildAllowedKeysFromWatchlist(watched: ReadonlySet<string>): Set<string> {
  const keys = new Set<string>();
  for (const w of watched) {
    for (const alias of watchlistWatchedAliasKeys(w)) {
      if (alias.startsWith(WATCHLIST_CRYPTO_PREFIX) || alias.startsWith(WATCHLIST_INDEX_PREFIX)) {
        continue;
      }
      keys.add(canonicalEarningsScopeKey(alias));
    }
  }
  return keys;
}

export function buildAllowedKeysFromHoldings(symbols: readonly string[]): Set<string> {
  const keys = new Set<string>();
  for (const s of symbols) {
    const sym = s.trim().toUpperCase();
    if (!sym || sym.includes(":")) continue;
    keys.add(canonicalEarningsScopeKey(sym));
  }
  return keys;
}

export function parseAllowedScopeKeysParam(raw: string | null): Set<string> | null {
  if (!raw?.trim()) return null;
  const keys = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map(canonicalEarningsScopeKey);
  return new Set(keys);
}

export function serializeAllowedScopeKeys(keys: ReadonlySet<string>): string {
  return [...keys].sort((a, b) => a.localeCompare(b)).join(",");
}

function filterEarningsTimingBucket(
  bucket: EarningsTimingBucket,
  allowed: ReadonlySet<string>,
): EarningsTimingBucket {
  const items = bucket.items.filter((it) => earningsItemMatchesScope(it, allowed));
  return {
    items,
    overflowCount: allowed.size === 0 ? 0 : bucket.overflowCount,
  };
}

export function filterEarningsWeekPayload(
  data: EarningsWeekPayload,
  allowed: ReadonlySet<string> | null,
): EarningsWeekPayload {
  if (!allowed) return data;

  const days: EarningsDayColumn[] = data.days.map((day) => ({
    ...day,
    beforeMarket: filterEarningsTimingBucket(day.beforeMarket, allowed),
    afterMarket: filterEarningsTimingBucket(day.afterMarket, allowed),
    timeTbd: filterEarningsTimingBucket(day.timeTbd, allowed),
  }));

  const hasAnyEvents = days.some((day) => {
    const b = day.beforeMarket;
    const a = day.afterMarket;
    const t = day.timeTbd;
    return (
      b.items.length + b.overflowCount + a.items.length + a.overflowCount + t.items.length + t.overflowCount >
      0
    );
  });

  return { ...data, days, hasAnyEvents };
}

export function filterEarningsCalendarItems(
  items: readonly EarningsCalendarItem[],
  allowed: ReadonlySet<string> | null,
): EarningsCalendarItem[] {
  if (!allowed) return [...items];
  return items.filter((it) => earningsItemMatchesScope(it, allowed));
}
