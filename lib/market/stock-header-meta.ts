/** Normalized company metadata for the stock detail header (API + UI). */
export type StockDetailHeaderMeta = {
  sector: string | null;
  industry: string | null;
  earningsDateDisplay: string | null;
  /** Global count of watchlist rows for this plain ticker; null if unavailable. */
  watchlistCount: number | null;
};

export function formatHeaderMetaSegment(value: string | null | undefined): string {
  const v = typeof value === "string" ? value.trim() : "";
  return v ? v : "-";
}

export function formatWatchlistsCountLabel(count: number | null): string {
  if (count == null) return "-";
  if (count === 0) return "0 Watchlists";
  return `${count.toLocaleString("en-US")} Watchlists`;
}
