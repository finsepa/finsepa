/** Cookie + localStorage key for desktop watchlist rail collapsed state. */
export const WATCHLIST_RAIL_COLLAPSED_PREFERENCE_KEY = "finsepa-watchlist-rail-collapsed";

/** Missing preference defaults to collapsed (star strip only). */
export function readWatchlistRailCollapsedPreference(raw: string | undefined | null): boolean {
  if (raw == null || raw === "") return true;
  return raw === "1";
}
