import { CryptoPageContent } from "@/components/crypto/crypto-page-content";
import { loadCryptoPageInitialData } from "@/lib/market/crypto-page-initial-data";
import { isSingleAssetMode, isSupportedAsset } from "@/lib/features/single-asset";

type PageProps = {
  params: Promise<{ symbol: string }>;
};

export default async function CryptoSymbolPage({ params }: PageProps) {
  const { symbol } = await params;
  const routeSymbol = decodeURIComponent(symbol).trim().toUpperCase();

  if (isSingleAssetMode() && !isSupportedAsset(routeSymbol)) {
    return <div className="px-9 py-6 text-[#71717A]">Temporarily unavailable in NVDA-only mode.</div>;
  }

  const initialData = await loadCryptoPageInitialData(routeSymbol);
  return <CryptoPageContent routeSymbol={routeSymbol} initialData={initialData} />;
}

