import "server-only";

import { unstable_cache } from "next/cache";

import { REVALIDATE_STATIC_DAY } from "@/lib/data/cache-policy";

export type CryptoFearGreedIndex = {
  value: number;
  classification: string;
  /** Unix seconds */
  timestamp: number;
  /** Seconds until next update (only present for latest) */
  timeUntilUpdateSec: number | null;
  /** Attribution required by provider terms. */
  source: "alternative.me";
};

type AlternativeFngApiResponse = {
  data?: Array<{
    value?: string;
    value_classification?: string;
    timestamp?: string;
    time_until_update?: string;
  }>;
};

function parseIntSafe(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return Math.trunc(v);
  if (typeof v === "string" && v.trim()) {
    const n = Number(v);
    return Number.isFinite(n) ? Math.trunc(n) : null;
  }
  return null;
}

async function fetchAlternativeFearGreedUncached(): Promise<CryptoFearGreedIndex | null> {
  try {
    const res = await fetch("https://api.alternative.me/fng/?limit=1&format=json", {
      next: { revalidate: REVALIDATE_STATIC_DAY },
    });
    if (!res.ok) return null;
    const json = (await res.json()) as AlternativeFngApiResponse;
    const row = Array.isArray(json.data) ? json.data[0] : null;
    if (!row) return null;

    const value = parseIntSafe(row.value);
    const ts = parseIntSafe(row.timestamp);
    if (value == null || ts == null) return null;

    const clamped = Math.max(0, Math.min(100, value));
    const classification =
      typeof row.value_classification === "string" && row.value_classification.trim()
        ? row.value_classification.trim()
        : "—";
    const timeUntilUpdateSec = parseIntSafe(row.time_until_update);

    return {
      value: clamped,
      classification,
      timestamp: ts,
      timeUntilUpdateSec,
      source: "alternative.me",
    };
  } catch {
    return null;
  }
}

const getAlternativeFearGreedCached = unstable_cache(
  fetchAlternativeFearGreedUncached,
  ["alternative-fear-greed-v1"],
  { revalidate: REVALIDATE_STATIC_DAY },
);

/** Crypto Fear & Greed Index (Alternative.me), cached and shared across users. */
export async function getCryptoFearGreedIndex(): Promise<CryptoFearGreedIndex | null> {
  return getAlternativeFearGreedCached();
}

export type CryptoFearGreedHistoryPoint = {
  value: number;
  classification: string;
  /** Unix seconds */
  timestamp: number;
};

async function fetchAlternativeFearGreedHistoryUncached(limit: number): Promise<CryptoFearGreedHistoryPoint[]> {
  try {
    const safeLimit = Math.trunc(limit);
    const limitParam = safeLimit === 0 ? "0" : String(Math.max(1, Math.min(5000, safeLimit || 180)));
    const res = await fetch(`https://api.alternative.me/fng/?limit=${limitParam}&format=json`, {
      next: { revalidate: REVALIDATE_STATIC_DAY },
    });
    if (!res.ok) return [];
    const json = (await res.json()) as AlternativeFngApiResponse;
    const data = Array.isArray(json.data) ? json.data : [];
    const out: CryptoFearGreedHistoryPoint[] = [];
    for (const row of data) {
      const value = parseIntSafe(row.value);
      const ts = parseIntSafe(row.timestamp);
      if (value == null || ts == null) continue;
      const classification =
        typeof row.value_classification === "string" && row.value_classification.trim()
          ? row.value_classification.trim()
          : "—";
      out.push({ value: Math.max(0, Math.min(100, value)), classification, timestamp: ts });
    }
    // API returns latest first; sort ascending for charting.
    out.sort((a, b) => a.timestamp - b.timestamp);
    return out;
  } catch {
    return [];
  }
}

/** Cached across users; daily data so 24h TTL is fine. */
export async function getCryptoFearGreedHistory(limit = 180): Promise<CryptoFearGreedHistoryPoint[]> {
  const safeLimit = Math.trunc(limit);
  const key = safeLimit === 0 ? "all" : String(Math.max(1, Math.min(5000, safeLimit || 180)));
  return unstable_cache(
    () => fetchAlternativeFearGreedHistoryUncached(safeLimit),
    ["alternative-fear-greed-history-v2", key],
    { revalidate: REVALIDATE_STATIC_DAY },
  )();
}

