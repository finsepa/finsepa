import { notFound } from "next/navigation";

import { loadStockPageInitialData } from "@/lib/market/stock-page-initial-data";
import { fetchStockEarningsTabPayload } from "@/lib/market/stock-earnings-tab-data";
import { StockPageClient } from "./stock-page-client";
import { isSingleAssetMode, isSupportedAsset } from "@/lib/features/single-asset";
import { parseStockDetailTabQuery, type StockDetailTabId } from "@/lib/stock/stock-detail-tab";
import { normalizeStockDetailTab } from "@/lib/stock/stock-etf";

export const dynamic = "force-dynamic";

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
  const { ticker: tickerParam } = await params;
  if (typeof tickerParam !== "string" || !tickerParam.trim()) {
    notFound();
  }
  let routeTicker: string;
  try {
    routeTicker = decodeURIComponent(tickerParam).trim();
  } catch {
    notFound();
  }
  if (!routeTicker) {
    notFound();
  }
  const sp = searchParams ? await searchParams : {};
  const tabFromUrl = tabFromSearchParams(sp);

  if (isSingleAssetMode() && !isSupportedAsset(routeTicker)) {
    return (
      <div className="px-4 py-4 text-[#71717A] sm:px-9 sm:py-6">Temporarily unavailable in NVDA-only mode.</div>
    );
  }

  const [initialPageData, earningsTabPayload] = await Promise.all([
    loadStockPageInitialData(routeTicker),
    tabFromUrl === "earnings" ? fetchStockEarningsTabPayload(routeTicker) : Promise.resolve(null),
  ]);
  if (!initialPageData) {
    notFound();
  }
  if (earningsTabPayload) {
    initialPageData.earningsTabPayload = earningsTabPayload;
  }

  const initialActiveTab = normalizeStockDetailTab(tabFromUrl, initialPageData.isEtf);

  return (
    <StockPageClient
      routeTicker={routeTicker}
      initialPageData={initialPageData}
      initialActiveTab={initialActiveTab}
    />
  );
}
