import { IndexPageContent } from "@/components/index/index-page-content";
import { isSingleAssetMode } from "@/lib/features/single-asset";
import { loadIndexPageInitialData } from "@/lib/market/index-page-initial-data";
import { isIndexPageSymbol } from "@/lib/market/index-page-shared";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ symbol: string }>;
};

export default async function IndexSymbolPage({ params }: PageProps) {
  const { symbol: raw } = await params;
  const routeSymbol = decodeURIComponent(raw).trim().toUpperCase();

  if (isSingleAssetMode()) {
    return (
      <div className="px-4 py-4 text-fg-muted sm:px-9 sm:py-6">Temporarily unavailable in NVDA-only mode.</div>
    );
  }

  if (!isIndexPageSymbol(routeSymbol)) {
    notFound();
  }

  const initialData = await loadIndexPageInitialData(routeSymbol);
  return <IndexPageContent routeSymbol={routeSymbol} initialData={initialData} />;
}
