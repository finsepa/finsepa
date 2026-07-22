/** Feature flag: strict semantic validation on workspace PUT. */

export function isPortfolioLedgerStrictPersistEnabled(): boolean {
  return process.env.FINSEPA_PORTFOLIO_LEDGER_STRICT === "1";
}
