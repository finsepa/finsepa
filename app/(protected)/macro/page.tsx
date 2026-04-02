import { MacroPage } from "@/components/macro/macro-page";
import { isSingleAssetMode } from "@/lib/features/single-asset";

export default function Page() {
  if (isSingleAssetMode()) {
    return <div className="px-9 py-6 text-[#71717A]">Temporarily unavailable in NVDA-only mode.</div>;
  }
  return <MacroPage />;
}

