import { CryptoPageContent } from "@/components/crypto/crypto-page-content";
import { loadCryptoPageInitialData } from "@/lib/market/crypto-page-initial-data";
import { isSingleAssetMode, isSupportedAsset } from "@/lib/features/single-asset";
import { parseCryptoDetailTabQuery, type CryptoDetailTabId } from "@/lib/crypto/crypto-detail-tab";

type PageProps = {
  params: Promise<{ symbol: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function tabFromSearchParams(sp: Record<string, string | string[] | undefined> | undefined): CryptoDetailTabId {
  const raw = sp?.tab;
  const s = Array.isArray(raw) ? raw[0] : raw;
  return parseCryptoDetailTabQuery(s ?? null) ?? "overview";
}

export default async function CryptoSymbolPage({ params, searchParams }: PageProps) {
  const { symbol } = await params;
  const routeSymbol = decodeURIComponent(symbol).trim().toUpperCase();
  const sp = searchParams ? await searchParams : {};
  const initialActiveTab = tabFromSearchParams(sp);

  if (isSingleAssetMode() && !isSupportedAsset(routeSymbol)) {
    return <div className="px-4 py-4 text-[#71717A] sm:px-9 sm:py-6">Temporarily unavailable in NVDA-only mode.</div>;
  }

  const initialData = await loadCryptoPageInitialData(routeSymbol);
  return (
    <CryptoPageContent
      routeSymbol={routeSymbol}
      initialData={initialData}
      initialActiveTab={initialActiveTab}
    />
  );
}

