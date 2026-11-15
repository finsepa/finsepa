"use client";

import Link from "next/link";
import type { CSSProperties } from "react";

import { AllocationBarValue } from "@/components/portfolio/allocation-weight-pie";
import { CompanyLogo } from "@/components/screener/company-logo";
import {
  DEFAULT_TABLE_ROW_HOVER_PAD_CLASS,
  SCREENER_TABLE_DATA_ROW_CLASS,
  SCREENER_TABLE_HEADER_STICKY_CLASS,
  SCREENER_TABLE_HEADER_STROKE_HOVER_CLASS,
  SCREENER_TABLE_ROUNDED_HEADER_CLASS,
  SCREENER_TABLE_ROW_HOVER_SURFACE_CLASS,
  SCREENER_TABLE_STROKE_INSET_CLASS,
  TABLE_END_ALIGNED_PAD_CLASS,
  TABLE_START_ALIGNED_PAD_CLASS,
  ScreenerTableScroll,
} from "@/components/screener/screener-table-scroll";
import type { EtfHolding } from "@/lib/market/etf-profile-types";
import { formatUsdCompact } from "@/lib/market/key-stats-basic-format";
import { useEtfProfile } from "@/lib/market/use-etf-profile";
import { cn } from "@/lib/utils";

const MAX_LISTED_HOLDINGS = 20;

/** Holding | Allocation bar | Value — same row rhythm as the portfolio holdings table. */
const HOLDINGS_GRID_CLASS = "grid w-full min-w-0 items-center gap-x-2";
const HOLDINGS_GRID_STYLE: CSSProperties = {
  gridTemplateColumns: "minmax(0,1.4fr) minmax(96px,1fr) minmax(88px,140px)",
};

/** Matches screener / portfolio asset column — ticker, underline on row hover. */
const HOLDING_TICKER_CLASS =
  "truncate text-[14px] font-semibold leading-5 text-fg underline-offset-2 decoration-fg-muted group-hover/row:underline";

function HoldingRow({ holding, maxWeight }: { holding: EtfHolding; maxWeight: number }) {
  const cells = (
    <div
      className={cn(
        HOLDINGS_GRID_CLASS,
        "min-h-[56px] text-[14px] font-normal leading-5",
        SCREENER_TABLE_ROW_HOVER_SURFACE_CLASS,
      )}
      style={HOLDINGS_GRID_STYLE}
    >
      <div className={cn("flex min-w-0 items-center gap-3 pr-2", TABLE_START_ALIGNED_PAD_CLASS)}>
        <CompanyLogo name={holding.name} logoUrl={holding.logoUrl} symbol={holding.code} />
        <div className="min-w-0 text-left">
          <div className={HOLDING_TICKER_CLASS}>{holding.code}</div>
          <div className="truncate text-[12px] font-normal leading-4 text-fg-muted">{holding.name}</div>
        </div>
      </div>
      <AllocationBarValue
        pct={holding.weightPct}
        maxPct={maxWeight}
        label={holding.weightPct.toFixed(2)}
        className="px-2"
      />
      <div
        className={cn(
          "min-w-0 w-full whitespace-nowrap text-right font-['Inter'] tabular-nums text-fg",
          TABLE_END_ALIGNED_PAD_CLASS,
        )}
      >
        {holding.valueUsd != null ? formatUsdCompact(holding.valueUsd) : "—"}
      </div>
    </div>
  );
  return (
    <div className={SCREENER_TABLE_DATA_ROW_CLASS}>
      <div className={DEFAULT_TABLE_ROW_HOVER_PAD_CLASS}>
        {holding.href ? (
          <Link
            href={holding.href}
            prefetch={false}
            className="block rounded-[10px] outline-none focus-visible:ring-2 focus-visible:ring-fg/15"
            aria-label={`Open ${holding.name}`}
          >
            {cells}
          </Link>
        ) : (
          cells
        )}
      </div>
    </div>
  );
}

function HoldingsTable({ holdings }: { holdings: EtfHolding[] }) {
  const maxWeight = Math.max(...holdings.map((h) => h.weightPct), 0) || 1;
  return (
    <ScreenerTableScroll>
      <div className="bg-surface">
        <div
          className={cn(
            SCREENER_TABLE_HEADER_STICKY_CLASS,
            SCREENER_TABLE_ROUNDED_HEADER_CLASS,
            SCREENER_TABLE_HEADER_STROKE_HOVER_CLASS,
            "md:border-b-0",
          )}
        >
          <div className={DEFAULT_TABLE_ROW_HOVER_PAD_CLASS}>
            <div
              className={cn(HOLDINGS_GRID_CLASS, "min-h-[44px] text-[14px] font-medium leading-5 text-fg-muted")}
              style={HOLDINGS_GRID_STYLE}
            >
              <div className={cn("text-left", TABLE_START_ALIGNED_PAD_CLASS)}>Holding</div>
              <div className="min-w-0 px-2 text-left">Allocation</div>
              <div className={cn("min-w-0 w-full text-right", TABLE_END_ALIGNED_PAD_CLASS)}>Value</div>
            </div>
          </div>
          <div className={SCREENER_TABLE_STROKE_INSET_CLASS} aria-hidden />
        </div>
        {holdings.map((h) => (
          <HoldingRow key={h.code} holding={h} maxWeight={maxWeight} />
        ))}
      </div>
    </ScreenerTableScroll>
  );
}

/** ETF Overview holdings — top constituents table (EODHD `ETF_Data`); nothing while loading or empty. */
export function EtfHoldingsTable({ ticker, isActive }: { ticker: string; isActive: boolean }) {
  const { profile, loading } = useEtfProfile(ticker, isActive);
  if (loading || !profile) return null;

  const lookThrough = profile.lookThrough;
  const holdings = (lookThrough?.holdings ?? profile.holdings).slice(0, MAX_LISTED_HOLDINGS);
  if (!holdings.length) return null;

  return (
    <section aria-label="Holdings" className="space-y-2">
      <HoldingsTable holdings={holdings} />
      {lookThrough ? (
        <p className="px-1 text-[12px] leading-4 text-fg-muted">
          This fund holds{" "}
          <Link href={`/stock/${encodeURIComponent(lookThrough.viaCode)}`} prefetch={false} className="font-medium text-fg hover:underline">
            {lookThrough.viaCode}
          </Link>
          ; holdings shown through it, weighted by this fund&apos;s exposure.
        </p>
      ) : null}
    </section>
  );
}
