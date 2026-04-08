/**
 * Browser-side helpers: try stock endpoints first, then crypto (same as New Transaction).
 */

export async function fetchPriceOnDateClient(symbol: string, ymd: string): Promise<number | null> {
  const enc = encodeURIComponent(symbol.trim());
  try {
    const stockRes = await fetch(`/api/stocks/${enc}/price-on-date?date=${encodeURIComponent(ymd)}`);
    if (stockRes.ok) {
      const data = (await stockRes.json()) as { price?: number | null };
      if (typeof data.price === "number" && Number.isFinite(data.price) && data.price > 0) {
        return data.price;
      }
    }
  } catch {
    /* continue */
  }

  try {
    const cryptoRes = await fetch(`/api/crypto/${enc}/price-on-date?date=${encodeURIComponent(ymd)}`);
    if (cryptoRes.ok) {
      const data = (await cryptoRes.json()) as { price?: number | null };
      if (typeof data.price === "number" && Number.isFinite(data.price) && data.price > 0) {
        return data.price;
      }
    }
  } catch {
    /* null */
  }

  return null;
}

export async function fetchLiveMarketPriceClient(symbol: string): Promise<number | null> {
  const enc = encodeURIComponent(symbol.trim());
  try {
    const stockRes = await fetch(`/api/stocks/${enc}/performance`);
    if (stockRes.ok) {
      const data = (await stockRes.json()) as { price?: number | null };
      if (typeof data.price === "number" && Number.isFinite(data.price) && data.price > 0) {
        return data.price;
      }
    }
  } catch {
    /* continue */
  }

  try {
    const cryptoRes = await fetch(`/api/crypto/${enc}/performance`);
    if (cryptoRes.ok) {
      const data = (await cryptoRes.json()) as { price?: number | null };
      if (typeof data.price === "number" && Number.isFinite(data.price) && data.price > 0) {
        return data.price;
      }
    }
  } catch {
    /* null */
  }

  return null;
}
