import type { StockEarningsTabPayload } from "@/lib/market/stock-earnings-types";

export function stockEarningsTabApiUrl(ticker: string, preview = false): string {
  const sym = encodeURIComponent(ticker.trim().toUpperCase());
  return `/api/stocks/${sym}/earnings${preview ? "?preview=1" : ""}`;
}

const inflight = new Map<string, Promise<StockEarningsTabPayload | null>>();

/** Keep successful payloads so close → reopen does not wait on another round-trip. */
const memory = new Map<string, { at: number; payload: StockEarningsTabPayload }>();
const MEMORY_TTL_MS = 15 * 60 * 1000;

function readMemory(url: string): StockEarningsTabPayload | null {
  const hit = memory.get(url);
  if (!hit) return null;
  if (Date.now() - hit.at > MEMORY_TTL_MS) {
    memory.delete(url);
    return null;
  }
  return hit.payload;
}

function writeMemory(url: string, payload: StockEarningsTabPayload | null): void {
  if (!payload) return;
  memory.set(url, { at: Date.now(), payload });
}

/** Sync read of the in-memory cache (no network) — used to paint prefetched data immediately. */
export function peekStockEarningsTabPayloadClient(
  ticker: string,
  preview = false,
): StockEarningsTabPayload | null {
  return readMemory(stockEarningsTabApiUrl(ticker, preview));
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
  if (readMemory(url)) return;
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
  options?: { preview?: boolean; signal?: AbortSignal },
): Promise<StockEarningsTabPayload | null> {
  const url = stockEarningsTabApiUrl(ticker, options?.preview ?? false);
  const cached = readMemory(url);
  if (cached) return cached;

  const pending = inflight.get(url);
  if (pending) {
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
