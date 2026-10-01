/**
 * Cookie + localStorage key for desktop watchlist rail collapsed state.
 * v2: the v1 key was auto-written as "collapsed" for every visitor, so it can't tell real choices apart.
 */
export const WATCHLIST_RAIL_COLLAPSED_PREFERENCE_KEY = "finsepa-watchlist-rail-collapsed-v2";

/** Missing preference defaults to expanded; an explicit collapse is remembered. */
export function readWatchlistRailCollapsedPreference(raw: string | undefined | null): boolean {
  if (raw == null || raw === "") return false;
  return raw === "1";
}
