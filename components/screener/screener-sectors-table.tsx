"use client";

import Link from "next/link";

import type { ScreenerSectorRow } from "@/lib/screener/screener-sectors-types";
import type { ScreenerCanonicalSector } from "@/lib/screener/screener-gics-sectors";
import { screenerSectorDrillHref } from "@/lib/screener/screener-stocks-sub-tab-url";
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

const colLayoutMobile = "grid-cols-[28px_minmax(0,1fr)_72px] gap-x-2";
const colLayoutDesktop = "sm:grid-cols-[48px_minmax(0,1.6fr)_1fr_1fr_1fr] sm:gap-x-2";

function formatPctValue(value: number) {
  return `${value > 0 ? "+" : ""}${value.toFixed(2)}%`;
}

/** Matches {@link ScreenerTable} `ChangeCell` (missing value + color rules). */
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

/**
 * Screener “Sectors” tab — layout/spacing aligned with {@link ScreenerTable} (Web App Design).
 * Sector names drill in on the Sectors tab (companies table for that sector).
 */
export function ScreenerSectorsTable({
  rows,
  hideMobileHeader = false,
  embeddedInMobileCard = false,
}: {
  rows: ScreenerSectorRow[];
  hideMobileHeader?: boolean;
  embeddedInMobileCard?: boolean;
}) {
  if (rows.length === 0) {
    return (
      <div
        className={cn(
          "px-4 py-6 text-center text-[14px] leading-6 text-[#5C5D5F]",
          !embeddedInMobileCard &&
            "rounded-2xl border border-[#EBEBEC] bg-white shadow-[0px_1px_2px_0px_rgba(0,0,0,0.04)]",
        )}
      >
        No sector data is available for the current screener list.
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
              <div className="text-left">Sector</div>
              <div className="min-w-0 w-full pr-3 text-right">1D %</div>
              <div className="hidden min-w-0 w-full pr-3 text-right sm:block">YTD %</div>
              <div className="hidden min-w-0 w-full pr-3 text-right sm:block">Market Cap</div>
            </div>
          </div>
          <div className={SCREENER_TABLE_STROKE_INSET_CLASS} aria-hidden />
        </div>

        {rows.map((row, index) => (
          <div key={row.sector} className={SCREENER_TABLE_DATA_ROW_CLASS}>
            <div className={SCREENER_TABLE_ROW_HOVER_PAD_CLASS}>
              <Link
                href={screenerSectorDrillHref(row.sector as ScreenerCanonicalSector)}
                prefetch={false}
                className={cn(
                  `grid ${colLayoutMobile} ${colLayoutDesktop} min-h-[56px] cursor-pointer items-center no-underline transition-colors duration-75 visited:text-inherit focus-visible:z-[1] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#141414]/25 sm:min-h-[60px]`,
                  SCREENER_TABLE_ROW_HOVER_SURFACE_CLASS,
                )}
              >
                <div className="text-center text-[14px] font-semibold leading-5 tabular-nums text-[#5C5D5F]">
                  {row.rank}
                </div>
                <div className="min-w-0">
                  <span className="block truncate text-left text-[14px] font-semibold leading-5 text-[#141414] underline-offset-2 decoration-[#5C5D5F] group-hover/row:underline">
                    {row.sector}
                  </span>
                  <span className="mt-0.5 block truncate text-left text-[12px] font-normal leading-4 text-[#5C5D5F] sm:hidden">
                    {row.marketCapDisplay}
                  </span>
                </div>
                <PctCell value={row.change1D} />
                <div className="hidden sm:contents">
                  <PctCell value={row.changeYTD} />
                </div>
                <div className="hidden min-w-0 w-full pr-3 text-right font-['Inter'] text-[14px] font-normal leading-5 tabular-nums text-[#141414] sm:block">
                  {row.marketCapDisplay}
                </div>
              </Link>
            </div>
            {index < rows.length - 1 ? (
              <div className={SCREENER_TABLE_STROKE_INSET_CLASS} aria-hidden />
            ) : null}
          </div>
        ))}
      </div>
    </ScreenerTableScroll>
  );
}
