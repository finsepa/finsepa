/**
 * Session cache for last portfolio mark-to-market prices (top-bar / deferred chrome).
 * Avoids blank/$0 totals when we skip live-quotes on Screener/hubs.
 */

export const PORTFOLIO_QUOTE_SESSION_TTL_MS = 180_000; // 3 min

export type PortfolioQuoteSessionPayload = {
  ledger: string;
  at: number;
  /** Uppercase symbol → last live USD mark. */
  prices: Record<string, number>;
};

export function readPortfolioQuoteSession(key: string): PortfolioQuoteSessionPayload | null {
  if (typeof sessionStorage === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PortfolioQuoteSessionPayload> | null;
    if (!parsed || typeof parsed.ledger !== "string" || typeof parsed.at !== "number") {
      return null;
    }
    const prices: Record<string, number> = {};
    if (parsed.prices && typeof parsed.prices === "object") {
      for (const [sym, p] of Object.entries(parsed.prices)) {
        if (typeof p === "number" && Number.isFinite(p) && p > 0) {
          prices[sym.trim().toUpperCase()] = p;
        }
      }
    }
    return { ledger: parsed.ledger, at: parsed.at, prices };
  } catch {
    return null;
  }
}

export function writePortfolioQuoteSession(
  key: string,
  payload: PortfolioQuoteSessionPayload,
): void {
  if (typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.setItem(key, JSON.stringify(payload));
  } catch {
    // ignore quota / private mode
  }
}

export function portfolioQuoteSessionIsFresh(
  session: PortfolioQuoteSessionPayload | null,
  ledgerFingerprint: string,
  now = Date.now(),
  ttlMs = PORTFOLIO_QUOTE_SESSION_TTL_MS,
): boolean {
  if (!session) return false;
  if (session.ledger !== ledgerFingerprint) return false;
  return now - session.at < ttlMs;
}

/** True when every holding symbol has a positive mark in the session map. */
export function portfolioSliceHasSessionMarks(
  slice: Record<string, { symbol: string }[]>,
  prices: Record<string, number>,
): boolean {
  const symbols = new Set<string>();
  for (const holds of Object.values(slice)) {
    for (const h of holds) {
      const sym = h.symbol.trim().toUpperCase();
      if (sym) symbols.add(sym);
    }
  }
  if (symbols.size === 0) return true;
  for (const sym of symbols) {
    const p = prices[sym];
    if (typeof p !== "number" || !Number.isFinite(p) || p <= 0) return false;
  }
  return true;
}
