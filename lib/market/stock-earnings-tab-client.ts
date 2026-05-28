import type { StockEarningsTabPayload } from "@/lib/market/stock-earnings-types";

export function stockEarningsTabApiUrl(ticker: string, preview = false): string {
  const sym = encodeURIComponent(ticker.trim().toUpperCase());
  return `/api/stocks/${sym}/earnings${preview ? "?preview=1" : ""}`;
}

const inflight = new Map<string, Promise<StockEarningsTabPayload | null>>();

function fetchEarningsJson(url: string, signal?: AbortSignal): Promise<StockEarningsTabPayload | null> {
  return fetch(url, signal ? { signal } : undefined).then(async (res) => {
    if (!res.ok) return null;
    return (await res.json()) as StockEarningsTabPayload;
  });
}

/** Warm the CDN / server cache before the calendar modal opens. */
export function prefetchStockEarningsTabPayload(ticker: string, preview = true): void {
  const url = stockEarningsTabApiUrl(ticker, preview);
  if (inflight.has(url)) return;
  const p = fetchEarningsJson(url).catch(() => null);
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
  const pending = inflight.get(url);
  if (pending) {
    try {
      return await pending;
    } catch {
      return null;
    }
  }
  try {
    return await fetchEarningsJson(url, options?.signal);
  } catch {
    return null;
  }
}
