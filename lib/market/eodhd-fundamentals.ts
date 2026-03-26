import "server-only";

import { getEodhdApiKey } from "@/lib/env/server";
import { toEodhdUsSymbol } from "@/lib/market/eodhd-symbol";

export type EodhdFundamentalsHighlights = {
  marketCapUsd: number | null;
  peTrailing: number | null;
  peForward: number | null;
};

function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim()) {
    const n = Number(v.replace(/,/g, ""));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/**
 * Pulls Highlights (market cap, P/E) when available for the subscription.
 * @see https://eodhd.com/financial-apis/stock-etfs-fundamental-data-feeds/
 */
export async function fetchEodhdFundamentalsHighlights(ticker: string): Promise<EodhdFundamentalsHighlights | null> {
  const key = getEodhdApiKey();
  if (!key) return null;

  const sym = toEodhdUsSymbol(ticker);
  const url = `https://eodhd.com/api/fundamentals/${encodeURIComponent(sym)}?api_token=${encodeURIComponent(key)}&fmt=json`;

  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    const root = (await res.json()) as Record<string, unknown> | null;
    if (!root || typeof root !== "object" || "error" in root) return null;

    const hl = root.Highlights;
    const highlights = hl && typeof hl === "object" ? (hl as Record<string, unknown>) : null;

    let marketCapUsd: number | null = null;
    let peTrailing: number | null = null;
    let peForward: number | null = null;

    if (highlights) {
      marketCapUsd = num(
        highlights.MarketCapitalization ?? highlights.MarketCapitalisation ?? highlights.MarketCap,
      );
      peTrailing = num(highlights.PERatio ?? highlights.TrailingPE ?? highlights.PeRatio);
      peForward = num(highlights.ForwardPE ?? highlights.ForwardPe ?? highlights.ForwardPEPS);
    }

    const val = root.Valuation;
    if (val && typeof val === "object") {
      const v = val as Record<string, unknown>;
      if (marketCapUsd == null) marketCapUsd = num(v.MarketCapitalization);
      if (peTrailing == null) peTrailing = num(v.PERatio ?? v.TrailingPE);
      if (peForward == null) peForward = num(v.ForwardPE);
    }

    if (marketCapUsd == null && peTrailing == null && peForward == null) return null;

    return { marketCapUsd, peTrailing, peForward };
  } catch {
    return null;
  }
}
