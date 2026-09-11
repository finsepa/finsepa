import { loadIndexPageInitialData } from "@/lib/market/index-page-initial-data";
import { IndexPageContent } from "@/components/index/index-page-content";

/** Async RSC child — streams after Suspense / loading.tsx shell. */
export async function IndexPageData({ routeSymbol }: { routeSymbol: string }) {
  const initialData = await loadIndexPageInitialData(routeSymbol);
  return <IndexPageContent routeSymbol={routeSymbol} initialData={initialData} />;
}
