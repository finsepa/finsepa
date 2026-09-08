/**
 * Q4 CDN `doc_financials` bases for issuers where IR HTML is bot-blocked or CDN
 * is not embedded in the landing page HTML we can fetch server-side.
 */
export const Q4CDN_KNOWN_FINANCIALS_BASE_BY_TICKER: Record<string, string> = {
  PYPL: "https://s205.q4cdn.com/875401827/files/doc_financials",
  /** pginvestor.com embeds design CDN only; quarter PDFs live on s204 (JS-loaded pages). */
  PG: "https://s204.q4cdn.com/332108499/files/doc_financials",
  /** investor.oracle.com is Cloudflare-walled; PDFs on s23 (doc_financials + doc_earnings). */
  ORCL: "https://s23.q4cdn.com/440135859/files/doc_financials",
  /** investor.mastercard.com is Cloudflare-walled; earnings decks on s25. */
  MA: "https://s25.q4cdn.com/479285134/files/doc_financials",
  /** investor.jnj.com is Cloudflare-walled; earnings decks on s203. */
  JNJ: "https://s203.q4cdn.com/636242992/files/doc_financials",
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
