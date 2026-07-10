import { notFound } from "next/navigation";

import { AssetNewsPageContent } from "@/components/stock/asset-news-page-content";
import { loadStockNewsPage } from "@/lib/market/stock-news";
import { STOCK_NEWS_PAGE_SIZE } from "@/lib/market/stock-news-types";
import { isSingleAssetMode, isSupportedAsset } from "@/lib/features/single-asset";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ ticker: string }>;
};

export default async function StockNewsPage({ params }: PageProps) {
  const { ticker: tickerParam } = await params;
  if (typeof tickerParam !== "string" || !tickerParam.trim()) {
    notFound();
  }
  let routeTicker: string;
  try {
    routeTicker = decodeURIComponent(tickerParam).trim().toUpperCase();
  } catch {
    notFound();
  }
  if (!routeTicker) {
    notFound();
  }

  if (isSingleAssetMode() && !isSupportedAsset(routeTicker)) {
    return (
      <div className="px-4 py-4 text-[#71717A] sm:px-9 sm:py-6">Temporarily unavailable in NVDA-only mode.</div>
    );
  }

  const initialItems = await loadStockNewsPage(routeTicker, 0, STOCK_NEWS_PAGE_SIZE, {
    resolveOgImages: true,
  });

  return (
    <AssetNewsPageContent ticker={routeTicker} variant="stock" initialItems={initialItems} />
  );
}
