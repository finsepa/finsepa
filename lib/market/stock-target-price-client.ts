import type { StockTargetPricePayload } from "@/lib/market/stock-target-price-types";

export function stockTargetPriceApiUrl(ticker: string): string {
  return `/api/stocks/${encodeURIComponent(ticker.trim().toUpperCase())}/target-price`;
}

const inflight = new Map<string, Promise<StockTargetPricePayload | null>>();
const memory = new Map<string, { at: number; payload: StockTargetPricePayload }>();
const MEMORY_TTL_MS = 15 * 60 * 1000;

function readMemory(url: string): StockTargetPricePayload | null {
  const hit = memory.get(url);
  if (!hit) return null;
  if (Date.now() - hit.at > MEMORY_TTL_MS) {
    memory.delete(url);
    return null;
  }
  return hit.payload;
}

function writeMemory(url: string, payload: StockTargetPricePayload | null): void {
  if (!payload) return;
  memory.set(url, { at: Date.now(), payload });
}

function fetchTargetPriceJson(url: string, signal?: AbortSignal): Promise<StockTargetPricePayload | null> {
  return fetch(url, signal ? { credentials: "include", signal } : { credentials: "include" }).then(async (res) => {
    if (!res.ok) return null;
    return (await res.json()) as StockTargetPricePayload;
  });
}

export function peekStockTargetPricePayloadClient(ticker: string): StockTargetPricePayload | null {
  return readMemory(stockTargetPriceApiUrl(ticker));
}

export function prefetchStockTargetPricePayload(ticker: string): void {
  const url = stockTargetPriceApiUrl(ticker);
  if (readMemory(url) || inflight.has(url)) return;
  const p = fetchTargetPriceJson(url)
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

export async function fetchStockTargetPricePayloadClient(
  ticker: string,
  signal?: AbortSignal,
): Promise<StockTargetPricePayload | null> {
  const url = stockTargetPriceApiUrl(ticker);
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
    const payload = await fetchTargetPriceJson(url, signal);
    writeMemory(url, payload);
    return payload;
  } catch {
    return null;
  }
}
