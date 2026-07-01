/**
 * Q4 CDN `doc_financials` bases for issuers where IR HTML is bot-blocked or CDN
 * is not embedded in the landing page HTML we can fetch server-side.
 */
export const Q4CDN_KNOWN_FINANCIALS_BASE_BY_TICKER: Record<string, string> = {
  PYPL: "https://s205.q4cdn.com/875401827/files/doc_financials",
};

export function knownQ4CdnBaseForTicker(ticker: string): {
  filesBase: string;
  financialsBase: string;
} | null {
  const financialsBase = Q4CDN_KNOWN_FINANCIALS_BASE_BY_TICKER[ticker.trim().toUpperCase()];
  if (!financialsBase) return null;
  const filesBase = financialsBase.replace(/\/doc_financials\/?$/, "");
  return { filesBase, financialsBase: financialsBase.replace(/\/+$/, "") };
}
