"use client";

import Link from "next/link";
import { useMemo } from "react";

import type { ScreenerIndustryRow } from "@/lib/screener/screener-industries-types";
import type { ScreenerCanonicalSector } from "@/lib/screener/screener-gics-sectors";
import { screenerIndustryDrillHref } from "@/lib/screener/screener-industry-url";
import {
  SCREENER_TABLE_DATA_ROW_CLASS,
  SCREENER_TABLE_HEADER_STICKY_CLASS,
  SCREENER_TABLE_HEADER_STROKE_HOVER_CLASS,
  SCREENER_TABLE_ROUNDED_HEADER_CLASS,
  SCREENER_TABLE_ROW_HOVER_PAD_CLASS,
  SCREENER_TABLE_ROW_HOVER_SURFACE_CLASS,
  SCREENER_TABLE_STROKE_INSET_CLASS,
  ScreenerTableScroll,
} from "@/components/screener/screener-table-scroll";
import { cn } from "@/lib/utils";

/** # | Industry | 1D | MCap — sector appears only in group headers; industry links drill in on the Industries tab. */
const colLayoutMobile = "grid-cols-[28px_minmax(0,1fr)_72px] gap-x-2";
const colLayoutDesktop = "sm:grid-cols-[48px_minmax(0,1.6fr)_1fr_1fr] sm:gap-x-2";

function formatPctValue(value: number) {
  return `${value > 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function PctCell({ value }: { value: number | null }) {
  if (value == null || !Number.isFinite(value)) {
    return <div className="min-w-0 w-full pr-3 text-right text-[14px] leading-5 font-medium text-[#5C5D5F]">-</div>;
  }
  const positive = value >= 0;
  return (
    <div
      className={`min-w-0 w-full pr-3 text-right tabular-nums text-[14px] leading-5 font-medium ${
        positive ? "text-[#16A34A]" : "text-[#DC2626]"
      }`}
    >
      {formatPctValue(value)}
    </div>
  );
}

export function ScreenerIndustriesTable({
  rows,
  hideMobileHeader = false,
  embeddedInMobileCard = false,
}: {
  rows: ScreenerIndustryRow[];
  hideMobileHeader?: boolean;
  embeddedInMobileCard?: boolean;
}) {
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
      <div
        className={cn(
          "px-4 py-6 text-center text-[14px] leading-6 text-[#5C5D5F]",
          !embeddedInMobileCard &&
            "rounded-2xl border border-[#EBEBEC] bg-white shadow-[0px_1px_2px_0px_rgba(0,0,0,0.04)]",
        )}
      >
        No industry data is available for the current screener list.
      </div>
    );
  }

  return (
    <ScreenerTableScroll minWidthClassName="min-w-0" embeddedInMobileCard={embeddedInMobileCard}>
      <div className="bg-white">
        <div
          className={cn(
            SCREENER_TABLE_HEADER_STICKY_CLASS,
            SCREENER_TABLE_ROUNDED_HEADER_CLASS,
            SCREENER_TABLE_HEADER_STROKE_HOVER_CLASS,
            "md:border-b-0",
            hideMobileHeader && "max-md:hidden",
          )}
        >
          <div className={SCREENER_TABLE_ROW_HOVER_PAD_CLASS}>
            <div
              className={`grid ${colLayoutMobile} ${colLayoutDesktop} min-h-[44px] items-center text-[14px] font-medium leading-5 text-[#5C5D5F]`}
            >
              <div className="text-center">#</div>
              <div className="text-left">Industry</div>
              <div className="min-w-0 w-full pr-3 text-right">1D %</div>
              <div className="hidden min-w-0 w-full pr-3 text-right sm:block">Market Cap</div>
            </div>
          </div>
          <div className={SCREENER_TABLE_STROKE_INSET_CLASS} aria-hidden />
        </div>

        {grouped.map(({ sector, items }, groupIndex) => (
          <div key={sector}>
            <div className={SCREENER_TABLE_ROW_HOVER_PAD_CLASS}>
              <div className="rounded-[10px] bg-[#F4F4F5] px-3 py-2.5 md:px-3">
                <h3 className="text-[14px] font-semibold leading-5 text-[#5C5D5F]">{sector}</h3>
              </div>
            </div>
            {groupIndex > 0 || items.length > 0 ? (
              <div className={SCREENER_TABLE_STROKE_INSET_CLASS} aria-hidden />
            ) : null}
            {items.map((row, i) => (
              <div key={`${row.sector}-${row.industry}`} className={SCREENER_TABLE_DATA_ROW_CLASS}>
                <div className={SCREENER_TABLE_ROW_HOVER_PAD_CLASS}>
                  <Link
                    href={screenerIndustryDrillHref(row.sector as ScreenerCanonicalSector, row.industry)}
                    prefetch={false}
                    className={cn(
                      `grid ${colLayoutMobile} ${colLayoutDesktop} min-h-[56px] cursor-pointer items-center no-underline transition-colors duration-75 visited:text-inherit focus-visible:z-[1] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#141414]/25 sm:min-h-[60px]`,
                      SCREENER_TABLE_ROW_HOVER_SURFACE_CLASS,
                    )}
                  >
                    <div className="text-center text-[14px] font-semibold leading-5 tabular-nums text-[#5C5D5F]">
                      {i + 1}
                    </div>
                    <div className="min-w-0">
                      <span className="block truncate text-left text-[14px] font-semibold leading-5 text-[#141414] underline-offset-2 decoration-[#5C5D5F] group-hover/row:underline">
                        {row.industry}
                      </span>
                      <span className="mt-0.5 block truncate text-left text-[12px] font-normal leading-4 text-[#5C5D5F] sm:hidden">
                        {row.marketCapDisplay}
                      </span>
                    </div>
                    <PctCell value={row.change1D} />
                    <div className="hidden min-w-0 w-full pr-3 text-right font-['Inter'] text-[14px] font-normal leading-5 tabular-nums text-[#141414] sm:block">
                      {row.marketCapDisplay}
                    </div>
                  </Link>
                </div>
                {i < items.length - 1 ? (
                  <div className={SCREENER_TABLE_STROKE_INSET_CLASS} aria-hidden />
                ) : null}
              </div>
            ))}
          </div>
        ))}
      </div>
    </ScreenerTableScroll>
  );
}
