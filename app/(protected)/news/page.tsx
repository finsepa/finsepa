import { NewsPage } from "@/components/news/news-page";
import { isSingleAssetMode } from "@/lib/features/single-asset";

export default function News() {
  if (isSingleAssetMode()) {
    return <div className="px-4 py-4 text-[#71717A] sm:px-9 sm:py-6">Temporarily unavailable in NVDA-only mode.</div>;
  }
  return <NewsPage />;
}

