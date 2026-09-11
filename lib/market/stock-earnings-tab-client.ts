import type { StockEarningsTabPayload } from "@/lib/market/stock-earnings-types";

export function stockEarningsTabApiUrl(ticker: string, preview = false): string {
  const sym = encodeURIComponent(ticker.trim().toUpperCase());
  return `/api/stocks/${sym}/earnings${preview ? "?preview=1" : ""}`;
}

const inflight = new Map<string, Promise<StockEarningsTabPayload | null>>();

/**
 * Sticky paint cache — reported history barely changes between releases; keep it
 * for instant revisit / tab remount. Network freshness is gated separately.
 */
const PAINT_TTL_MS = 12 * 60 * 60 * 1000;
/** Skip network when a payload this fresh already exists (upcoming / estimates). */
const NETWORK_SKIP_TTL_MS = 5 * 60 * 1000;

const memory = new Map<string, { at: number; payload: StockEarningsTabPayload }>();

function readMemory(url: string, maxAgeMs: number): StockEarningsTabPayload | null {
  const hit = memory.get(url);
  if (!hit) return null;
  const age = Date.now() - hit.at;
  if (age > maxAgeMs) {
    if (maxAgeMs < PAINT_TTL_MS && age <= PAINT_TTL_MS) {
      // Stale for network-skip, but still usable for paint via peek (PAINT_TTL).
      return null;
    }
    memory.delete(url);
    return null;
  }
  return hit.payload;
}

function writeMemory(url: string, payload: StockEarningsTabPayload | null): void {
  if (!payload) return;
  memory.set(url, { at: Date.now(), payload });
}

/** Sync read for immediate paint (long TTL). */
export function peekStockEarningsTabPayloadClient(
  ticker: string,
  preview = false,
): StockEarningsTabPayload | null {
  return readMemory(stockEarningsTabApiUrl(ticker, preview), PAINT_TTL_MS);
}

/** True when memory is fresh enough to skip a network round-trip. */
export function isStockEarningsTabPayloadFreshClient(ticker: string, preview = false): boolean {
  return readMemory(stockEarningsTabApiUrl(ticker, preview), NETWORK_SKIP_TTL_MS) != null;
}

function fetchEarningsJson(url: string, signal?: AbortSignal): Promise<StockEarningsTabPayload | null> {
  return fetch(url, signal ? { signal } : undefined).then(async (res) => {
    if (!res.ok) return null;
    return (await res.json()) as StockEarningsTabPayload;
  });
}

/** Warm the CDN / server cache before the calendar modal opens. */
export function prefetchStockEarningsTabPayload(ticker: string, preview = true): void {
  const url = stockEarningsTabApiUrl(ticker, preview);
  if (readMemory(url, NETWORK_SKIP_TTL_MS)) return;
  if (inflight.has(url)) return;
  const p = fetchEarningsJson(url)
    .then((payload) => {
      writeMemory(url, payload);
      return payload;
    })
    .catch(() => null);
  inflight.set(url, p);
  void p.finally(() => {
    if (inflight.get(url) === p) inflight.delete(url);
  });
}

export async function fetchStockEarningsTabPayloadClient(
  ticker: string,
  options?: { preview?: boolean; signal?: AbortSignal; force?: boolean },
): Promise<StockEarningsTabPayload | null> {
  const url = stockEarningsTabApiUrl(ticker, options?.preview ?? false);
  if (!options?.force) {
    const fresh = readMemory(url, NETWORK_SKIP_TTL_MS);
    if (fresh) return fresh;
  }

  const pending = inflight.get(url);
  if (pending && !options?.force) {
    try {
      return await pending;
    } catch {
      return null;
    }
  }
  try {
    const payload = await fetchEarningsJson(url, options?.signal);
    writeMemory(url, payload);
    return payload;
  } catch {
    return null;
  }
}
