import { notFound } from "next/navigation";

import { AssetNewsPageContent } from "@/components/stock/asset-news-page-content";
import { getCryptoNews } from "@/lib/market/crypto-news";
import { isSingleAssetMode, isSupportedAsset } from "@/lib/features/single-asset";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ symbol: string }>;
};

export default async function CryptoNewsPage({ params }: PageProps) {
  const { symbol: symbolParam } = await params;
  if (typeof symbolParam !== "string" || !symbolParam.trim()) {
    notFound();
  }
  let routeSymbol: string;
  try {
    routeSymbol = decodeURIComponent(symbolParam).trim().toUpperCase();
  } catch {
    notFound();
  }
  if (!routeSymbol) {
    notFound();
  }

  if (isSingleAssetMode() && !isSupportedAsset(routeSymbol)) {
    return (
      <div className="px-4 py-4 text-[#71717A] sm:px-9 sm:py-6">Temporarily unavailable in NVDA-only mode.</div>
    );
  }

  const initialItems = await getCryptoNews(routeSymbol);

  return (
    <AssetNewsPageContent ticker={routeSymbol} variant="crypto" initialItems={initialItems} />
  );
}
