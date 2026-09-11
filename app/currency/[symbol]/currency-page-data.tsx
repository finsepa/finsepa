import { loadCurrencyPageInitialData } from "@/lib/market/currency-page-initial-data";
import { CurrencyPageContent } from "@/components/currency/currency-page-content";

/** Async RSC child — streams after Suspense / loading.tsx shell. */
export async function CurrencyPageData({ routeSymbol }: { routeSymbol: string }) {
  const initialData = await loadCurrencyPageInitialData(routeSymbol);
  return <CurrencyPageContent routeSymbol={routeSymbol} initialData={initialData} />;
}
