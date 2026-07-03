"use client";

import { LatestNews } from "@/components/stock/latest-news";
import type { StockNewsArticle } from "@/lib/market/stock-news-types";

export function AssetNewsPageContent({
  ticker,
  variant,
  initialItems,
}: {
  ticker: string;
  variant: "stock" | "crypto";
  initialItems?: StockNewsArticle[];
}) {
  return (
    <div className="min-w-0 max-md:bg-[#FAFAFA] max-md:px-4 md:px-4 md:py-4 lg:px-9 lg:py-6">
      <LatestNews
        ticker={ticker}
        variant={variant}
        initialItems={initialItems}
        presentation="full"
      />
    </div>
  );
}
