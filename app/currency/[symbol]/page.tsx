import { Suspense } from "react";
import { notFound } from "next/navigation";

import { StockPageSkeleton } from "@/components/stock/stock-page-skeleton";
import { isSingleAssetMode } from "@/lib/features/single-asset";
import { isCurrencyPageSymbol } from "@/lib/market/currency-page-shared";

import { CurrencyPageData } from "./currency-page-data";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ symbol: string }>;
};

/**
 * Stream shell first (`loading.tsx` + Suspense share StockPageSkeleton / pending soft-nav).
 */
export default async function CurrencySymbolPage({ params }: PageProps) {
  const { symbol: raw } = await params;
  const routeSymbol = decodeURIComponent(raw).trim().toUpperCase();

  if (isSingleAssetMode()) {
    return (
      <div className="px-4 py-4 text-fg-muted sm:px-9 sm:py-6">Temporarily unavailable in NVDA-only mode.</div>
    );
  }

  if (!isCurrencyPageSymbol(routeSymbol)) {
    notFound();
  }

  return (
    <Suspense fallback={<StockPageSkeleton />}>
      <CurrencyPageData routeSymbol={routeSymbol} />
    </Suspense>
  );
}
