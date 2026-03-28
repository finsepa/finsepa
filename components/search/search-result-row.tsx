"use client";

import { useState } from "react";
import Link from "next/link";
import type { SearchAssetItem } from "@/lib/search/search-types";

function LogoBlock({ item }: { item: SearchAssetItem }) {
  const [imgErr, setImgErr] = useState(false);
  if (item.logoUrl && !imgErr) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- remote favicon
      <img
        src={item.logoUrl}
        alt=""
        width={40}
        height={40}
        className="h-10 w-10 shrink-0 rounded-xl border border-neutral-200 bg-white object-contain"
        onError={() => setImgErr(true)}
      />
    );
  }
  const initials = item.symbol.slice(0, 2).toUpperCase();
  return (
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#E4E4E7] bg-[#F4F4F5] text-[11px] font-bold text-[#09090B]">
      {initials}
    </div>
  );
}

const categoryLabel: Record<SearchAssetItem["type"], string> = {
  stock: "Stock",
  crypto: "Crypto",
  index: "Index",
};

type Props = {
  item: SearchAssetItem;
  onNavigate: (item: SearchAssetItem) => void;
  active?: boolean;
};

export function SearchResultRow({ item, onNavigate, active }: Props) {
  return (
    <Link
      href={item.route}
      onClick={(e) => {
        e.preventDefault();
        onNavigate(item);
      }}
      className={`flex items-center gap-4 px-5 py-3 transition-colors ${
        active ? "bg-[#EEF2FF]" : "hover:bg-[#F4F4F5]"
      }`}
    >
      <LogoBlock item={item} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-[14px] font-semibold leading-5 text-[#09090B]">{item.name}</div>
        <div className="truncate text-[12px] leading-4 text-[#71717A]">{item.symbol}</div>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-0.5 text-right">
        <span className="rounded-full bg-[#F4F4F5] px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-[#71717A]">
          {categoryLabel[item.type]}
        </span>
        {item.marketLabel ? (
          <span className="max-w-[140px] truncate text-[12px] text-[#A1A1AA]">{item.marketLabel}</span>
        ) : null}
      </div>
    </Link>
  );
}
