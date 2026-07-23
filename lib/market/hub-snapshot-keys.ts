import type { NewsTab } from "@/lib/news/news-types";

/** Supabase `market_snapshot.key` for hub / calendar pages (P3). */
export const HUB_SNAPSHOT_KEY = {
  macroDashboard: "hub_macro_dashboard",
  newsStocks: "hub_news_stocks",
  newsCrypto: "hub_news_crypto",
  newsIndices: "hub_news_indices",
} as const;

export type HubSnapshotFixedKey = (typeof HUB_SNAPSHOT_KEY)[keyof typeof HUB_SNAPSHOT_KEY];

export type HubSnapshotKey = HubSnapshotFixedKey | `hub_earnings_week_${string}` | `hub_economy_week_${string}_${string}`;

export function hubEarningsWeekKey(weekMondayYmd: string): HubSnapshotKey {
  return `hub_earnings_week_${weekMondayYmd}`;
}

export function hubEconomyWeekKey(weekMondayYmd: string, countryCode: string): HubSnapshotKey {
  const cc = countryCode.trim().toUpperCase() || "US";
  return `hub_economy_week_${weekMondayYmd}_${cc}`;
}

export function hubNewsKey(tab: NewsTab): HubSnapshotFixedKey {
  if (tab === "crypto") return HUB_SNAPSHOT_KEY.newsCrypto;
  if (tab === "indices") return HUB_SNAPSHOT_KEY.newsIndices;
  return HUB_SNAPSHOT_KEY.newsStocks;
}

export function macroHubSegment(now: Date = new Date()): string {
  // v20: US spot Bitcoin ETF net flows (Farside) in Crypto section.
  return `macro-day-v20-${nyCalendarYmd(now)}`;
}

export function newsHubSegment(tab: NewsTab, now: Date = new Date()): string {
  return `news-${tab}-${nyCalendarYmd(now)}`;
}

export function earningsWeekHubSegment(weekMondayYmd: string): string {
  return `earnings-week-v34-precomputed-estimates-${weekMondayYmd}`;
}

export function economyWeekHubSegment(weekMondayYmd: string, countryCode: string): string {
  const cc = countryCode.trim().toUpperCase() || "US";
  return `economy-week-${weekMondayYmd}-${cc}`;
}

function nyCalendarYmd(now: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}
