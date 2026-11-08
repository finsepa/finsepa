/**
 * Client poll cadence.
 * Allowlisted live-WS tickers match crypto (5s header); others stay on EODHD cache TTL.
 * @see REVALIDATE_STOCK_1D_LIVE_SPOT, REVALIDATE_STOCK_1D_LIVE_CHART in cache-policy
 */
import {
  REVALIDATE_STOCK_1D_LIVE_CHART,
  REVALIDATE_STOCK_1D_LIVE_SPOT,
} from "@/lib/data/cache-policy";

/** Live header spot for non-allowlist / EODHD-backed quotes (15s cache coalesce). */
export const STOCK_1D_LIVE_PRICE_POLL_MS = REVALIDATE_STOCK_1D_LIVE_SPOT * 1000;

/**
 * Allowlisted WS-minute header poll — same cadence as crypto live-1D (`crypto-page-content` 5s).
 * WS tip is uncached; REST previousClose still coalesces via {@link REVALIDATE_STOCK_1D_LIVE_SPOT}.
 */
export const STOCK_1D_LIVE_WS_PRICE_POLL_MS = 5_000;

/** Live 1D chart history refresh — matches chart cache tier during regular session (30s). */
export const STOCK_1D_LIVE_CHART_POLL_MS = REVALIDATE_STOCK_1D_LIVE_CHART * 1000;
