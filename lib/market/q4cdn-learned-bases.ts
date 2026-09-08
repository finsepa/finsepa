//
//  q4cdn-learned-bases.ts
//
//  Derive Q4 CDN `doc_financials` bases from URLs we already resolved (cache / history).
//  No EODHD calls — closes older-quarter gaps once any quarter on the ticker succeeds.
//

import "server-only";

import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { knownQ4CdnBaseForTicker } from "@/lib/market/q4cdn-known-issuer-bases";

/** `https://s204.q4cdn.com/332108499/files/doc_financials/2025/q3/x.pdf` → financials base. */
export function q4CdnFinancialsBaseFromUrl(url: string | null | undefined): string | null {
  if (!url || typeof url !== "string") return null;
  const m = url.trim().match(/^(https:\/\/s\d+\.q4cdn\.com\/\d+\/files\/doc_financials)(?:\/|$)/i);
  return m?.[1]?.replace(/\/+$/, "") ?? null;
}

export function q4CdnBaseFromFinancialsBase(financialsBase: string): {
  filesBase: string;
  financialsBase: string;
} {
  const financials = financialsBase.replace(/\/+$/, "");
  const filesBase = financials.replace(/\/doc_financials$/i, "");
  return { filesBase, financialsBase: financials };
}

/** Prefer any q4cdn slides/filings URL already on the history rows (post-cache). */
export function learnedQ4CdnBaseFromHistoryUrls(
  urls: readonly (string | null | undefined)[],
): { filesBase: string; financialsBase: string } | null {
  for (const url of urls) {
    const financials = q4CdnFinancialsBaseFromUrl(url);
    if (financials) return q4CdnBaseFromFinancialsBase(financials);
  }
  return null;
}

/**
 * Hardcoded map first, then URLs on this request's rows, then last q4cdn sample for the ticker.
 * Cheap Supabase read only when rows did not already reveal a base.
 */
export async function resolveQ4CdnBaseForTicker(
  listingTicker: string,
  historyUrls: readonly (string | null | undefined)[],
): Promise<{ filesBase: string; financialsBase: string } | null> {
  const hardcoded = knownQ4CdnBaseForTicker(listingTicker);
  if (hardcoded) return hardcoded;

  const fromRows = learnedQ4CdnBaseFromHistoryUrls(historyUrls);
  if (fromRows) return fromRows;

  const admin = getSupabaseAdminClient();
  if (!admin) return null;

  const sym = listingTicker.trim().toUpperCase();
  const { data, error } = await admin
    .from("earnings_slide_host_patterns")
    .select("sample_url")
    .eq("deck_format", "q4cdn")
    .eq("last_ticker", sym)
    .order("last_seen_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data?.sample_url) return null;
  const financials = q4CdnFinancialsBaseFromUrl(data.sample_url);
  return financials ? q4CdnBaseFromFinancialsBase(financials) : null;
}
