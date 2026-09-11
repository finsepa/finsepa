import { Suspense } from "react";
import { notFound } from "next/navigation";

import { StockPageSkeleton } from "@/components/stock/stock-page-skeleton";
import { isSingleAssetMode, isSupportedAsset } from "@/lib/features/single-asset";
import { parseStockDetailTabQuery, type StockDetailTabId } from "@/lib/stock/stock-detail-tab";

import { StockPageData } from "./stock-page-data";

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

function chartingMetricFromSearchParams(
  sp: Record<string, string | string[] | undefined> | undefined,
): string | null {
  const raw = sp?.metric;
  const s = Array.isArray(raw) ? raw[0] : raw;
  if (typeof s !== "string") return null;
  const trimmed = s.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Stream shell first (route `loading.tsx` + Suspense fallback share StockPageSkeleton /
 * pending soft-nav). Slim SSR runs in {@link StockPageData}; nested Suspense streams
 * overview below-fold after header/chart.
 */
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
      <div className="px-4 py-4 text-fg-muted sm:px-9 sm:py-6">Temporarily unavailable in NVDA-only mode.</div>
    );
  }

  return (
    <Suspense fallback={<StockPageSkeleton />}>
      <StockPageData
        routeTicker={routeTicker}
        tabFromUrl={tabFromUrl}
        initialChartingMetric={chartingMetricFromSearchParams(sp)}
      />
    </Suspense>
  );
}
