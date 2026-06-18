export type PortfolioSnaptradeSyncSettings = {
  /** Automatically sync with the brokerage about once per day. */
  autoSyncDaily: boolean;
  /** When API returns no trades, synthesize buy rows from broker holdings. */
  emulateTransactionHistory: boolean;
  /** Reconcile shares and cash to broker balances after import. */
  adjustPositionsToBrokerage: boolean;
};

export const DEFAULT_PORTFOLIO_SNAPTRADE_SYNC_SETTINGS: PortfolioSnaptradeSyncSettings = {
  autoSyncDaily: true,
  emulateTransactionHistory: false,
  adjustPositionsToBrokerage: true,
};

export const SNAPTRADE_SYNC_SETTING_TOOLTIPS = {
  autoSyncDaily: "If enabled: we will automatically sync portfolio with brokerage once a day.",
  emulateTransactionHistory:
    "If enabled: when the broker API returns no transactions, Finsepa will create buy rows from current holdings to emulate history.",
  adjustPositionsToBrokerage:
    "If enabled: we will adjust shares and cash to match the brokerage so current positions stay correct. Transactions missing from the API response may be replaced during sync.",
} as const;

export function normalizePortfolioSnaptradeSyncSettings(
  raw: unknown,
): PortfolioSnaptradeSyncSettings {
  if (!raw || typeof raw !== "object") {
    return { ...DEFAULT_PORTFOLIO_SNAPTRADE_SYNC_SETTINGS };
  }
  const o = raw as Record<string, unknown>;
  return {
    autoSyncDaily:
      o.autoSyncDaily === false ? false : DEFAULT_PORTFOLIO_SNAPTRADE_SYNC_SETTINGS.autoSyncDaily,
    emulateTransactionHistory: o.emulateTransactionHistory === true,
    adjustPositionsToBrokerage:
      o.adjustPositionsToBrokerage === false ?
        false
      : DEFAULT_PORTFOLIO_SNAPTRADE_SYNC_SETTINGS.adjustPositionsToBrokerage,
  };
}
