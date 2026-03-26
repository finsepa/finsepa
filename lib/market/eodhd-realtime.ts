import "server-only";

import { getEodhdApiKey } from "@/lib/env/server";
import { toEodhdUsSymbol } from "@/lib/market/eodhd-symbol";

export type EodhdRealtimePayload = {
  code?: string;
  timestamp?: number;
  open?: number;
  high?: number;
  low?: number;
  close?: number;
  volume?: number;
  previousClose?: number;
  change?: number;
  change_p?: number;
};

/**
 * US exchange real-time quote. One HTTP request per symbol (batched at call site).
 * @see https://eodhd.com/financial-apis/live-realtime-stocks-api/
 */
export async function fetchEodhdUsRealtime(ticker: string): Promise<EodhdRealtimePayload | null> {
  const key = getEodhdApiKey();
  if (!key) return null;

  const symbol = toEodhdUsSymbol(ticker);
  const url = `https://eodhd.com/api/real-time/${encodeURIComponent(symbol)}?api_token=${encodeURIComponent(key)}&fmt=json`;

  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    const data = (await res.json()) as EodhdRealtimePayload & { error?: string };
    if (data && typeof data === "object" && "error" in data && data.error) return null;
    return data;
  } catch {
    return null;
  }
}
