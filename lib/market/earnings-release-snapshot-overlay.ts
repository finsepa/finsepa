import "server-only";

import {
  applyEarningsDocumentCacheToHistory,
  loadEarningsDocumentCacheForHistory,
} from "@/lib/market/earnings-document-cache-store";
import { applyEarningsIrVaultToHistory, loadEarningsIrVaultForTicker } from "@/lib/market/earnings-ir-vault-store";
import { applyEarningsReleaseSnapshotsToPayload } from "@/lib/market/earnings-release-snapshot-apply";
import type { StockEarningsTabPayload } from "@/lib/market/stock-earnings-types";
import { loadRecentEarningsReleaseSnapshotsForTicker } from "@/lib/notifications/earnings-release-snapshot-store";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

/** Re-apply Supabase doc vault/cache onto sticky payload so post-release warm is visible without EODHD. */
async function mergeLiveDocumentSourcesOntoPayload(
  payload: StockEarningsTabPayload,
): Promise<StockEarningsTabPayload> {
  const ticker = payload.ticker.trim().toUpperCase();
  if (!ticker || payload.history.length === 0) return payload;
  try {
    const [docCache, vault] = await Promise.all([
      loadEarningsDocumentCacheForHistory(ticker, payload.history),
      loadEarningsIrVaultForTicker(ticker),
    ]);
    let history = applyEarningsDocumentCacheToHistory(ticker, payload.history, docCache);
    history = applyEarningsIrVaultToHistory(ticker, history, vault);
    return { ...payload, history };
  } catch {
    return payload;
  }
}

/**
 * After sticky preview/full cache: patch with push-cron release snapshots + live doc cache.
 * Page path = Supabase only (no EODHD).
 */
export async function decorateStockEarningsTabPayloadWithReleaseState(
  payload: StockEarningsTabPayload | null,
): Promise<StockEarningsTabPayload | null> {
  if (!payload) return null;
  const admin = getSupabaseAdminClient();
  if (!admin) return payload;

  let next = payload;
  try {
    const snaps = await loadRecentEarningsReleaseSnapshotsForTicker(admin, payload.ticker);
    next = applyEarningsReleaseSnapshotsToPayload(next, snaps);
  } catch {
    /* best-effort */
  }
  return mergeLiveDocumentSourcesOntoPayload(next);
}
