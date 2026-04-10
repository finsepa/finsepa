import "server-only";

import { getEodhdApiKey } from "@/lib/env/server";
import { traceEodhdHttp } from "@/lib/market/provider-trace";

export type EodhdSearchRow = {
  Code?: string;
  Name?: string;
  Exchange?: string;
  Type?: string;
  Country?: string;
  Currency?: string;
};

/**
 * @see https://eodhd.com/financial-apis/search-api-for-stocks-etfs-mutual-funds/
 */
export async function fetchEodhdSearch(query: string, limit = 40): Promise<EodhdSearchRow[]> {
  const key = getEodhdApiKey();
  const q = query.trim();
  if (!key || q.length < 1) return [];

  const url = `https://eodhd.com/api/search/${encodeURIComponent(q)}?api_token=${encodeURIComponent(key)}&fmt=json&limit=${limit}`;

  try {
    if (!traceEodhdHttp("fetchEodhdSearch", { q: q.slice(0, 32), limit })) return [];
    const res = await fetch(url, { next: { revalidate: 120 } });
    if (!res.ok) return [];
    const data = (await res.json()) as unknown;
    if (!Array.isArray(data)) return [];
    return data.filter((x) => x && typeof x === "object") as EodhdSearchRow[];
  } catch {
    return [];
  }
}
