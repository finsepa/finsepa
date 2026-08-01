"use client";

import Link from "next/link";

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
import type { IndexComponentRow } from "@/lib/market/index-page-shared";
import { cn } from "@/lib/utils";

function formatWeight(weight: number | null): string {
  if (weight == null || !Number.isFinite(weight)) return "—";
  // EODHD often returns fraction (0.0275) or percent — treat ≤1 as fraction.
  const pct = Math.abs(weight) <= 1 ? weight * 100 : weight;
  return `${pct.toFixed(2)}%`;
}

export function IndexComponentsTable({
  rows,
  title = "Components",
}: {
  rows: IndexComponentRow[];
  title?: string;
}) {
  if (!rows.length) return null;

  return (
    <section className="min-w-0 space-y-3">
      <h2 className="text-[16px] font-semibold leading-6 text-fg">{title}</h2>
      <ScreenerTableScroll minWidthClassName="min-w-0" className="h-fit">
        <div className="bg-surface">
          <div
            className={cn(
              SCREENER_TABLE_HEADER_STICKY_CLASS,
              SCREENER_TABLE_ROUNDED_HEADER_CLASS,
              SCREENER_TABLE_HEADER_STROKE_HOVER_CLASS,
              "md:border-b-0",
            )}
          >
            <div className={SCREENER_TABLE_ROW_HOVER_PAD_CLASS}>
              <div className="grid min-h-[44px] w-full grid-cols-[minmax(0,1.4fr)_minmax(0,2fr)_1fr] items-center gap-x-2 py-0 text-[14px] font-medium leading-5 text-fg-muted sm:grid-cols-[minmax(0,1.2fr)_minmax(0,2.2fr)_minmax(0,1.4fr)_1fr]">
                <div>Symbol</div>
                <div>Name</div>
                <div className="hidden sm:block">Sector</div>
                <div className="text-right">Weight</div>
              </div>
            </div>
            <div className={SCREENER_TABLE_STROKE_INSET_CLASS} aria-hidden />
          </div>

          <div>
            {rows.map((row, i) => (
              <div key={`${row.code}-${i}`} className={SCREENER_TABLE_DATA_ROW_CLASS}>
                <div className={SCREENER_TABLE_ROW_HOVER_PAD_CLASS}>
                  <div
                    className={cn(
                      "grid min-h-[52px] w-full grid-cols-[minmax(0,1.4fr)_minmax(0,2fr)_1fr] items-center gap-x-2 sm:grid-cols-[minmax(0,1.2fr)_minmax(0,2.2fr)_minmax(0,1.4fr)_1fr]",
                      SCREENER_TABLE_ROW_HOVER_SURFACE_CLASS,
                    )}
                  >
                    <div className="min-w-0">
                      <Link
                        href={`/stock/${encodeURIComponent(row.code)}`}
                        className="truncate text-[14px] font-semibold text-fg underline-offset-2 hover:underline"
                      >
                        {row.code}
                      </Link>
                    </div>
                    <div className="min-w-0 truncate text-[14px] text-fg">{row.name}</div>
                    <div className="hidden min-w-0 truncate text-[14px] text-fg-muted sm:block">
                      {row.sector ?? "—"}
                    </div>
                    <div className="text-right text-[14px] tabular-nums text-fg">
                      {formatWeight(row.weight)}
                    </div>
                  </div>
                </div>
                {i < rows.length - 1 ? (
                  <div className={SCREENER_TABLE_STROKE_INSET_CLASS} aria-hidden />
                ) : null}
              </div>
            ))}
          </div>
        </div>
      </ScreenerTableScroll>
    </section>
  );
}
