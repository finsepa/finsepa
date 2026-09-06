/**
 * Client cache + prefetch for stock Insiders tab (Form 4 1Y payload).
 * Mirrors earnings-tab client: memory + inflight so hover/tab open skips a blank wait.
 */
import type { InsiderTransactionRow } from "@/lib/market/insider-transactions-types";

export type InsiderTransactionsClientPayload = {
  ticker: string;
  rows: InsiderTransactionRow[];
  windowFrom?: string;
  windowTo?: string;
};

export function stockInsiderTransactionsApiUrl(ticker: string): string {
  return `/api/stocks/${encodeURIComponent(ticker.trim().toUpperCase())}/insider-transactions`;
}

const inflight = new Map<string, Promise<InsiderTransactionsClientPayload | null>>();
const memory = new Map<string, { at: number; payload: InsiderTransactionsClientPayload }>();
const MEMORY_TTL_MS = 15 * 60 * 1000;

function readMemory(url: string): InsiderTransactionsClientPayload | null {
  const hit = memory.get(url);
  if (!hit) return null;
  if (Date.now() - hit.at > MEMORY_TTL_MS) {
    memory.delete(url);
    return null;
  }
  return hit.payload;
}

function writeMemory(url: string, payload: InsiderTransactionsClientPayload | null): void {
  if (!payload) return;
  memory.set(url, { at: Date.now(), payload });
}

export function peekStockInsiderTransactionsClient(
  ticker: string,
): InsiderTransactionsClientPayload | null {
  return readMemory(stockInsiderTransactionsApiUrl(ticker));
}

function fetchInsiderJson(
  url: string,
  signal?: AbortSignal,
): Promise<InsiderTransactionsClientPayload | null> {
  return fetch(url, signal ? { signal } : undefined).then(async (res) => {
    if (!res.ok) return null;
    const json = (await res.json()) as {
      ticker?: string;
      rows?: InsiderTransactionRow[];
      windowFrom?: string;
      windowTo?: string;
    };
    if (!Array.isArray(json.rows)) return null;
    return {
      ticker: typeof json.ticker === "string" ? json.ticker : "",
      rows: json.rows,
      windowFrom: typeof json.windowFrom === "string" ? json.windowFrom : undefined,
      windowTo: typeof json.windowTo === "string" ? json.windowTo : undefined,
    };
  });
}

/** Warm CDN / server snapshot before the Insiders tab mounts. */
export function prefetchStockInsiderTransactions(ticker: string): void {
  const url = stockInsiderTransactionsApiUrl(ticker);
  if (readMemory(url)) return;
  if (inflight.has(url)) return;
  const p = fetchInsiderJson(url)
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

export async function fetchStockInsiderTransactionsClient(
  ticker: string,
  options?: { signal?: AbortSignal },
): Promise<InsiderTransactionsClientPayload | null> {
  const url = stockInsiderTransactionsApiUrl(ticker);
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
    const payload = await fetchInsiderJson(url, options?.signal);
    writeMemory(url, payload);
    return payload;
  } catch {
    return null;
  }
}
