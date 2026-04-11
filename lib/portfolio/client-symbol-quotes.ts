/**
 * Browser-side quote helpers for portfolio / transactions.
 * Known crypto bases (BTC, ETH, …) must use `/api/crypto/...` first — stock routes can resolve
 * the same ticker to a different instrument (e.g. BTC → wrong equity price).
 */

import { cryptoRouteBase } from "@/lib/crypto/crypto-symbol-base";
import { isSupportedCryptoAssetSymbol } from "@/lib/crypto/crypto-logo-url";

function routeKey(symbol: string): string {
  return cryptoRouteBase(symbol.trim());
}

/** When true, never prefer `/api/stocks/...` for this symbol (avoids ticker collisions with equities). */
function preferCryptoQuotesFirst(symbol: string): boolean {
  return isSupportedCryptoAssetSymbol(routeKey(symbol));
}

async function readPerformancePrice(res: Response): Promise<number | null> {
  if (!res.ok) return null;
  const data = (await res.json()) as { price?: number | null };
  if (typeof data.price === "number" && Number.isFinite(data.price) && data.price > 0) {
    return data.price;
  }
  return null;
}

async function readPriceOnDate(res: Response): Promise<number | null> {
  if (!res.ok) return null;
  const data = (await res.json()) as { price?: number | null };
  if (typeof data.price === "number" && Number.isFinite(data.price) && data.price > 0) {
    return data.price;
  }
  return null;
}

async function fetchCryptoLivePrice(symbol: string): Promise<number | null> {
  const enc = encodeURIComponent(routeKey(symbol));
  try {
    const cryptoRes = await fetch(`/api/crypto/${enc}/performance`);
    return await readPerformancePrice(cryptoRes);
  } catch {
    return null;
  }
}

async function fetchStockLivePrice(symbol: string): Promise<number | null> {
  const enc = encodeURIComponent(symbol.trim());
  try {
    const stockRes = await fetch(`/api/stocks/${enc}/performance`);
    return await readPerformancePrice(stockRes);
  } catch {
    return null;
  }
}

async function fetchCryptoPriceOnDate(symbol: string, ymd: string): Promise<number | null> {
  const enc = encodeURIComponent(routeKey(symbol));
  const d = encodeURIComponent(ymd);
  try {
    const cryptoRes = await fetch(`/api/crypto/${enc}/price-on-date?date=${d}`);
    return await readPriceOnDate(cryptoRes);
  } catch {
    return null;
  }
}

async function fetchStockPriceOnDate(symbol: string, ymd: string): Promise<number | null> {
  const enc = encodeURIComponent(symbol.trim());
  const d = encodeURIComponent(ymd);
  try {
    const stockRes = await fetch(`/api/stocks/${enc}/price-on-date?date=${d}`);
    return await readPriceOnDate(stockRes);
  } catch {
    return null;
  }
}

export async function fetchPriceOnDateClient(symbol: string, ymd: string): Promise<number | null> {
  if (preferCryptoQuotesFirst(symbol)) {
    const c = await fetchCryptoPriceOnDate(symbol, ymd);
    if (c != null) return c;
    return null;
  }
  const s = await fetchStockPriceOnDate(symbol, ymd);
  if (s != null) return s;
  return fetchCryptoPriceOnDate(symbol, ymd);
}

export async function fetchLiveMarketPriceClient(symbol: string): Promise<number | null> {
  if (preferCryptoQuotesFirst(symbol)) {
    const c = await fetchCryptoLivePrice(symbol);
    if (c != null) return c;
    return null;
  }
  const s = await fetchStockLivePrice(symbol);
  if (s != null) return s;
  return fetchCryptoLivePrice(symbol);
}
