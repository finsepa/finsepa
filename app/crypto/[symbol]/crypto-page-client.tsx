"use client";

import { Suspense } from "react";

import { CryptoPageContent } from "@/components/crypto/crypto-page-content";
import { StockPageSkeleton } from "@/components/stock/stock-page-skeleton";
import type { CryptoPageInitialData } from "@/lib/market/crypto-page-initial-data";
import type { CryptoDetailTabId } from "@/lib/crypto/crypto-detail-tab";

export function CryptoPageClient({
  routeSymbol,
  initialData,
  initialActiveTab,
}: {
  routeSymbol: string;
  initialData: CryptoPageInitialData | null;
  initialActiveTab: CryptoDetailTabId;
}) {
  return (
    <Suspense fallback={<StockPageSkeleton />}>
      <CryptoPageContent
        routeSymbol={routeSymbol}
        initialData={initialData}
        initialActiveTab={initialActiveTab}
      />
    </Suspense>
  );
}
