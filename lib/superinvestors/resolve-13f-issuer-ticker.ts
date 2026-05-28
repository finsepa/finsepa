import "server-only";

import { unstable_cache } from "next/cache";

import { REVALIDATE_STATIC_DAY } from "@/lib/data/cache-policy";
import { fetchEodhdSearch, type EodhdSearchRow } from "@/lib/market/eodhd-search";

export function normalize13fIssuerSearchKey(issuer: string): string {
  return issuer.trim().toLowerCase().replace(/\s+/g, " ");
}

function scoreEodhdSearchRow(issuerLower: string, row: EodhdSearchRow): number {
  const name = (row.Name ?? "").toLowerCase().trim();
  const sym = (row.Code ?? "").toLowerCase().trim();
  if (!sym) return -1;
  let s = 0;
  const type = (row.Type ?? "").toLowerCase();
  if (type.includes("common stock") || type === "stock" || !type) s += 5;
  if (issuerLower === name) s += 10;
  if (issuerLower.includes(name) || name.includes(issuerLower)) s += 6;
  if (issuerLower.includes(sym)) s += 3;
  if (row.Exchange && /^(US|NASDAQ|NYSE|AMEX)/i.test(row.Exchange)) s += 2;
  return s;
}

async function resolve13fIssuerTickerUncached(issuer: string): Promise<string | null> {
  const q = issuer.trim();
  if (q.length < 2) return null;

  const issuerLower = q.toLowerCase();
  const rows = await fetchEodhdSearch(q, 40);
  if (!rows.length) return null;

  const ranked = rows
    .map((row) => ({ row, score: scoreEodhdSearchRow(issuerLower, row) }))
    .filter((x) => x.score >= 0)
    .sort((a, b) => b.score - a.score);

  const best = ranked[0]?.row;
  const code = best?.Code?.trim();
  if (!code) return null;
  return code.toUpperCase().replace(/\.US$/i, "");
}

/** One EODHD search per issuer name per day — shared across all users and profile pages. */
export async function resolve13fIssuerTickerCached(issuer: string): Promise<string | null> {
  const query = issuer.trim();
  if (query.length < 2) return null;
  const key = normalize13fIssuerSearchKey(query);
  return unstable_cache(() => resolve13fIssuerTickerUncached(query), ["13f-issuer-ticker-v1", key], {
    revalidate: REVALIDATE_STATIC_DAY,
  })();
}
