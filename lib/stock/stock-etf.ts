import { POPULAR_US_ETFS } from "@/lib/search/popular-us-etfs";
import type { StockDetailHeaderMeta } from "@/lib/market/stock-header-meta";
import type { StockDetailTabId } from "@/lib/stock/stock-detail-tab";

const POPULAR_ETF_TICKERS = new Set(POPULAR_US_ETFS.map((e) => e.ticker.trim().toUpperCase()));

/** Tabs shown on `/stock/[ticker]` when the symbol is an ETF. */
export const ETF_STOCK_DETAIL_TAB_IDS = ["overview", "holdings"] as const satisfies readonly StockDetailTabId[];

export function isEtfFromHeaderMeta(meta: StockDetailHeaderMeta | null | undefined): boolean {
  if (!meta) return false;
  const sector = (meta.sector ?? "").trim().toLowerCase();
  if (sector === "etfs" || sector === "etf") return true;
  const industry = (meta.industry ?? "").trim().toLowerCase();
  if (industry.includes("exchange traded") || /\betf\b/.test(industry)) return true;
  const name = (meta.fullName ?? "").trim();
  if (/\betf\b/i.test(name) || /\betn\b/i.test(name)) return true;
  if (/\bspdr\b/i.test(name) && /\btrust\b/i.test(name)) return true;
  if (/\bishares\b/i.test(name)) return true;
  if (/\bvanguard\b/i.test(name) && /\b(index )?fund\b/i.test(name)) return true;
  return false;
}

export function isStockDetailEtf(ticker: string, meta?: StockDetailHeaderMeta | null): boolean {
  const tk = ticker.trim().toUpperCase();
  if (POPULAR_ETF_TICKERS.has(tk)) return true;
  return isEtfFromHeaderMeta(meta);
}

export function coerceStockDetailTabForEtf(tab: StockDetailTabId): StockDetailTabId {
  if (tab === "overview" || tab === "holdings") return tab;
  return "overview";
}

export function normalizeStockDetailTab(tab: StockDetailTabId | null | undefined, isEtf: boolean): StockDetailTabId {
  const base = tab ?? "overview";
  return isEtf ? coerceStockDetailTabForEtf(base) : base;
}
