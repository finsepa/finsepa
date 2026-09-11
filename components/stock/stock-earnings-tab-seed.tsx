import { StockEarningsTab } from "@/components/stock/stock-earnings-tab";
import { fetchStockEarningsTabPayload } from "@/lib/market/stock-earnings-tab-data";

/**
 * Async RSC: load earnings preview after the stock shell streams (nested Suspense).
 * Skips SEC/IR crawl and calendar timing — client upgrades to full after paint.
 */
export async function StockEarningsTabSeed({ ticker }: { ticker: string }) {
  const payload = await fetchStockEarningsTabPayload(ticker, { preview: true });
  return <StockEarningsTab ticker={ticker} initialPayload={payload} />;
}
