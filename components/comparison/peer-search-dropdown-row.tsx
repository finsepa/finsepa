"use client";

import { eodhdCryptoSpotTickerDisplay } from "@/lib/crypto/eodhd-crypto-ticker-display";
import { SearchResultLogo, searchResultCategoryLabel } from "@/components/search/search-result-row";
import type { SearchAssetItem } from "@/lib/search/search-types";
import {
  dropdownMenuRichItemClassName,
} from "@/components/design-system/dropdown-menu-styles";
import { cn } from "@/lib/utils";

export function PeerSearchDropdownRow({
  item,
  onPick,
}: {
  item: SearchAssetItem;
  onPick: (item: SearchAssetItem) => void;
}) {
  return (
    <button
      type="button"
      className={cn(dropdownMenuRichItemClassName(), "items-center")}
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => onPick(item)}
    >
      <SearchResultLogo item={item} />
      <div className="min-w-0 flex-1">
        <div className="truncate font-medium">{item.name}</div>
        <div className="truncate text-[12px] text-[#71717A]">
          {item.type === "crypto" ? eodhdCryptoSpotTickerDisplay(item.symbol) : item.symbol}
        </div>
      </div>
      <span className="shrink-0 rounded-full bg-[#F4F4F5] px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-[#71717A]">
        {searchResultCategoryLabel(item)}
      </span>
    </button>
  );
}
