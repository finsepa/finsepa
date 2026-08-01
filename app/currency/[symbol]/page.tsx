import { CurrencyPageContent } from "@/components/currency/currency-page-content";
import { isSingleAssetMode } from "@/lib/features/single-asset";
import { loadCurrencyPageInitialData } from "@/lib/market/currency-page-initial-data";
import { isCurrencyPageSymbol } from "@/lib/market/currency-page-shared";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ symbol: string }>;
};

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

  const initialData = await loadCurrencyPageInitialData(routeSymbol);
  return <CurrencyPageContent routeSymbol={routeSymbol} initialData={initialData} />;
}
