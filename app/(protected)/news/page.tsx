import { NewsPage } from "@/components/news/news-page";
import { isSingleAssetMode } from "@/lib/features/single-asset";

export default function News() {
  if (isSingleAssetMode()) {
    return <div className="px-9 py-6 text-[#71717A]">Temporarily unavailable in NVDA-only mode.</div>;
  }
  return <NewsPage />;
}

