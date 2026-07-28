/**
 * Thin re-exports for Agent hub reads.
 * Only snapshot readers — never wire cold EODHD rebuilds through Agent tools.
 */
export {
  HUB_SNAPSHOT_KEY,
  newsHubSegment,
  earningsWeekHubSegment,
  economyWeekHubSegment,
  macroHubSegment,
  hubEarningsWeekKey,
  hubEconomyWeekKey,
  type HubSnapshotKey,
} from "@/lib/market/hub-snapshot-keys";
export { readHubSnapshot } from "@/lib/market/hub-snapshot-store";
