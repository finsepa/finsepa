import "server-only";

import { unstable_cache } from "next/cache";

import { REVALIDATE_WARM } from "@/lib/data/cache-policy";
import { fetchEodhdFundamentalsJson } from "@/lib/market/eodhd-fundamentals";

function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim()) {
    const n = Number(v.replace(/,/g, ""));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function extractSharesOutstanding(root: Record<string, unknown>): number | null {
  const hl = root.Highlights && typeof root.Highlights === "object" ? (root.Highlights as Record<string, unknown>) : null;
  const ss =
    root.SharesStats && typeof root.SharesStats === "object" ? (root.SharesStats as Record<string, unknown>) : null;
  let shares = num(ss?.SharesOutstanding ?? ss?.SharesOut);
  if (shares == null && hl) shares = num(hl.SharesOutstanding);
  if (shares == null || shares <= 0) return null;
  return shares;
}

async function loadSharesOutstandingUncached(ticker: string): Promise<number | null> {
  const root = await fetchEodhdFundamentalsJson(ticker);
  if (!root || typeof root !== "object") return null;
  return extractSharesOutstanding(root as Record<string, unknown>);
}

/** Latest reported shares outstanding (used to derive historical market cap ≈ price × shares). */
export const getCachedSharesOutstanding = unstable_cache(
  async (ticker: string) => loadSharesOutstandingUncached(ticker),
  ["stock-shares-outstanding-v1"],
  { revalidate: REVALIDATE_WARM },
);
