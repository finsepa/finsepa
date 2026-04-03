import { StockPageContent } from "@/components/stock/stock-page-content";
import { loadStockPageInitialData } from "@/lib/market/stock-page-initial-data";
import { isSingleAssetMode, isSupportedAsset } from "@/lib/features/single-asset";
import { parseStockDetailTabQuery, type StockDetailTabId } from "@/lib/stock/stock-detail-tab";

type PageProps = {
  params: Promise<{ ticker: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function tabFromSearchParams(sp: Record<string, string | string[] | undefined> | undefined): StockDetailTabId {
  const raw = sp?.tab;
  const s = Array.isArray(raw) ? raw[0] : raw;
  return parseStockDetailTabQuery(s ?? null) ?? "overview";
}

export default async function StockTickerPage({ params, searchParams }: PageProps) {
  const { ticker } = await params;
  const routeTicker = decodeURIComponent(ticker).trim();
  const sp = searchParams ? await searchParams : {};
  const initialActiveTab = tabFromSearchParams(sp);

  if (isSingleAssetMode() && !isSupportedAsset(routeTicker)) {
    return (
      <div className="px-9 py-6 text-[#71717A]">Temporarily unavailable in NVDA-only mode.</div>
    );
  }

  const initialPageData = await loadStockPageInitialData(routeTicker);

  return (
    <StockPageContent
      key={routeTicker}
      routeTicker={routeTicker}
      initialPageData={initialPageData}
      initialActiveTab={initialActiveTab}
    />
  );
}
