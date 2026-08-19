/**
 * Client poll cadence aligned to server `unstable_cache` TTLs (P1-2).
 * @see REVALIDATE_STOCK_1D_LIVE_SPOT, REVALIDATE_STOCK_1D_LIVE_CHART in cache-policy
 */
import {
  REVALIDATE_STOCK_1D_LIVE_CHART,
  REVALIDATE_STOCK_1D_LIVE_SPOT,
} from "@/lib/data/cache-policy";

/** Live header spot — matches `getStockSpotQuoteLiveSessionCached` (15s). */
export const STOCK_1D_LIVE_PRICE_POLL_MS = REVALIDATE_STOCK_1D_LIVE_SPOT * 1000;

/** Live 1D chart refresh — matches chart cache tier during regular session (30s). */
export const STOCK_1D_LIVE_CHART_POLL_MS = REVALIDATE_STOCK_1D_LIVE_CHART * 1000;
