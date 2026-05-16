"use client";

import Link from "next/link";
import { useMemo } from "react";

import type { ScreenerIndustryRow } from "@/lib/screener/screener-industries-types";
import type { ScreenerCanonicalSector } from "@/lib/screener/screener-gics-sectors";
import { screenerIndustryDrillHref } from "@/lib/screener/screener-industry-url";
import {
  SCREENER_TABLE_HEADER_STICKY_CLASS,
  ScreenerTableScroll,
} from "@/components/screener/screener-table-scroll";

/** # | Industry | 1D | YTD | MCap — sector appears only in group headers; industry links drill in on the Industries tab. */
const colLayoutMobile = "grid-cols-[28px_minmax(0,1fr)_72px_72px] gap-x-2";
const colLayoutDesktop = "sm:grid-cols-[48px_minmax(0,1.6fr)_1fr_1fr_1fr] sm:gap-x-2";

function formatPctValue(value: number) {
  return `${value > 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function PctCell({ value }: { value: number | null }) {
  if (value == null || !Number.isFinite(value)) {
    return <div className="min-w-0 w-full text-right text-[14px] leading-5 font-medium text-[#71717A]">-</div>;
  }
  const positive = value >= 0;
  return (
    <div
      className={`min-w-0 w-full text-right tabular-nums text-[14px] leading-5 font-medium ${
        positive ? "text-[#16A34A]" : "text-[#DC2626]"
      }`}
    >
      {formatPctValue(value)}
    </div>
  );
}

export function ScreenerIndustriesTable({ rows }: { rows: ScreenerIndustryRow[] }) {
  const grouped = useMemo(() => {
    const bySector = new Map<string, ScreenerIndustryRow[]>();
    for (const r of rows) {
      const list = bySector.get(r.sector) ?? [];
      list.push(r);
      bySector.set(r.sector, list);
    }
    for (const list of bySector.values()) {
      list.sort((a, b) => b.marketCapUsd - a.marketCapUsd || a.industry.localeCompare(b.industry));
    }
    const blocks = [...bySector.entries()].map(([sector, items]) => ({
      sector,
      items,
      totalCap: items.reduce((s, x) => s + x.marketCapUsd, 0),
    }));
    blocks.sort((a, b) => b.totalCap - a.totalCap || a.sector.localeCompare(b.sector));
    return blocks;
  }, [rows]);

  if (rows.length === 0) {
    return (
      <div className="rounded-[12px] border border-[#E4E4E7] bg-white px-4 py-6 text-center text-[14px] leading-6 text-[#71717A]">
        No industry data is available for the current screener list.
      </div>
    );
  }

  return (
    <ScreenerTableScroll minWidthClassName="min-w-0" className="overflow-x-hidden">
      <div className="bg-white">
        <div
          className={`grid ${colLayoutMobile} ${colLayoutDesktop} min-h-[44px] items-center border-b border-[#E4E4E7] px-2 py-0 text-[12px] font-medium leading-5 text-[#71717A] sm:px-4 sm:text-[14px] ${SCREENER_TABLE_HEADER_STICKY_CLASS}`}
        >
          <div className="text-center">#</div>
          <div className="text-left">Industry</div>
          <div className="min-w-0 w-full text-right">1D %</div>
          <div className="min-w-0 w-full text-right">YTD %</div>
          <div className="hidden min-w-0 w-full text-right sm:block">Market Cap</div>
        </div>

        {grouped.map(({ sector, items }) => (
          <div key={sector}>
            <div className="border-b border-[#E4E4E7] bg-[#F4F4F5] px-2 py-2.5 sm:px-4">
              <h3 className="text-[14px] font-semibold leading-5 text-[#09090B]">{sector}</h3>
            </div>
            {items.map((row, i) => (
              <Link
                key={`${row.sector}-${row.industry}`}
                href={screenerIndustryDrillHref(row.sector as ScreenerCanonicalSector, row.industry)}
                prefetch={false}
                className={`group grid ${colLayoutMobile} ${colLayoutDesktop} min-h-[56px] cursor-pointer items-center border-b border-[#E4E4E7] bg-white px-2 no-underline transition-colors duration-75 visited:text-inherit hover:bg-neutral-50 focus-visible:z-[1] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#09090B]/25 sm:min-h-[60px] sm:px-4`}
              >
                <div className="text-center text-[14px] font-semibold leading-5 tabular-nums text-[#71717A]">
                  {i + 1}
                </div>
                <div className="min-w-0">
                  <span className="block truncate text-left text-[14px] font-semibold leading-5 text-[#09090B] underline-offset-2 decoration-[#71717A] group-hover:underline">
                    {row.industry}
                  </span>
                  <span className="mt-0.5 block truncate text-left text-[12px] font-normal leading-4 text-[#71717A] sm:hidden">
                    {row.marketCapDisplay}
                  </span>
                </div>
                <PctCell value={row.change1D} />
                <PctCell value={row.changeYTD} />
                <div className="hidden min-w-0 w-full text-right font-['Inter'] text-[14px] font-normal leading-5 tabular-nums text-[#09090B] sm:block">
                  {row.marketCapDisplay}
                </div>
              </Link>
            ))}
          </div>
        ))}
      </div>
    </ScreenerTableScroll>
  );
}
