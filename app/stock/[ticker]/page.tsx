import { StockPageContent } from "@/components/stock/stock-page-content";
import { loadStockPageInitialData } from "@/lib/market/stock-page-initial-data";
import { isSingleAssetMode, isSupportedAsset } from "@/lib/features/single-asset";

type PageProps = {
  params: Promise<{ ticker: string }>;
};

export default async function StockTickerPage({ params }: PageProps) {
  const { ticker } = await params;
  const routeTicker = decodeURIComponent(ticker).trim();

  if (isSingleAssetMode() && !isSupportedAsset(routeTicker)) {
    return (
      <div className="px-9 py-6 text-[#71717A]">Temporarily unavailable in NVDA-only mode.</div>
    );
  }

  const initialPageData = await loadStockPageInitialData(routeTicker);

  return (
    <StockPageContent key={routeTicker} routeTicker={routeTicker} initialPageData={initialPageData} />
  );
}
