"use client";

import Image from "next/image";
import Link from "next/link";
import { Landmark } from "@/lib/icons";
import { useEffect, useMemo, useState } from "react";

import { STOCK_OVERVIEW_SECTION_HEADING_CLASS } from "@/components/design-system/card-surface-styles";
import { SkeletonBox } from "@/components/markets/skeleton";
import {
  SCREENER_TABLE_DATA_ROW_CLASS,
  SCREENER_TABLE_HEADER_STICKY_CLASS,
  SCREENER_TABLE_HEADER_STROKE_HOVER_CLASS,
  SCREENER_TABLE_ROUNDED_HEADER_CLASS,
  SCREENER_TABLE_ROW_HOVER_SURFACE_CLASS,
  SCREENER_TABLE_STROKE_INSET_CLASS,
  ScreenerTableScroll,
} from "@/components/screener/screener-table-scroll";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { cn } from "@/lib/utils";
import { formatSharesCompact, formatUsdCompactSigDigits } from "@/lib/market/key-stats-basic-format";

type SuperinvestorPosition = {
  superinvestorSlug: string;
  managerName: string;
  fundName: string;
  avatarSrc: string | null;
  weightPct: number;
  statusLabel: string | null;
  shares: number | null;
  valueUsd: number;
};

type Payload = {
  ticker: string;
  positions: SuperinvestorPosition[];
};

const pct = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Same insets as Insiders — outer 16px to hover, inner 12px inside the pill. */
const SUPERINVESTOR_ROW_PAD_CLASS = "px-4";

const SUPERINVESTOR_GRID =
  "grid min-w-[760px] w-full grid-cols-[minmax(220px,2.4fr)_minmax(88px,0.9fr)_minmax(140px,1.2fr)_minmax(110px,1fr)_minmax(110px,1fr)] items-center gap-x-4 px-3 lg:min-w-0";

function ActivityCell({ label }: { label: string | null }) {
  if (!label) return <span className="text-[#5C5D5F]">—</span>;
  const lower = label.toLowerCase();
  const down = lower.startsWith("reduce") || lower.startsWith("sold");
  const up = lower.startsWith("increase") || lower.startsWith("buy") || lower.startsWith("new");
  return (
    <span className={cn("font-medium", up ? "text-[#16A34A]" : down ? "text-[#DC2626]" : "text-[#5C5D5F]")}>
      {label}
    </span>
  );
}

function SuperinvestorsTableHeader() {
  return (
    <div
      className={cn(
        SCREENER_TABLE_HEADER_STICKY_CLASS,
        SCREENER_TABLE_ROUNDED_HEADER_CLASS,
        SCREENER_TABLE_HEADER_STROKE_HOVER_CLASS,
        "md:border-b-0",
      )}
    >
      <div className={SUPERINVESTOR_ROW_PAD_CLASS}>
        <div
          className={cn(
            SUPERINVESTOR_GRID,
            "min-h-[44px] text-[14px] font-medium leading-5 text-[#5C5D5F]",
          )}
        >
          <div className="text-left">Manager / Fund</div>
          <div className="text-right">% of portfolio</div>
          <div className="text-right">Recent activity</div>
          <div className="text-right">Shares</div>
          <div className="text-right">Value</div>
        </div>
      </div>
      <div className={SCREENER_TABLE_STROKE_INSET_CLASS} aria-hidden />
    </div>
  );
}

function SuperinvestorsTableSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <ScreenerTableScroll mobileScroll>
      <SuperinvestorsTableHeader />
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className={SCREENER_TABLE_DATA_ROW_CLASS} aria-hidden>
          <div className={SUPERINVESTOR_ROW_PAD_CLASS}>
            <div
              className={cn(
                SUPERINVESTOR_GRID,
                "min-h-[60px] animate-pulse",
                SCREENER_TABLE_ROW_HOVER_SURFACE_CLASS,
              )}
            >
              <div className="flex min-w-0 items-center gap-3 pr-2">
                <SkeletonBox className="h-10 w-10 shrink-0 rounded-full" />
                <div className="min-w-0 flex-1 space-y-2">
                  <SkeletonBox className="h-4 w-[50%] rounded" />
                  <SkeletonBox className="h-3.5 w-[65%] rounded" />
                </div>
              </div>
              <div className="flex justify-end">
                <SkeletonBox className="h-4 w-12 rounded" />
              </div>
              <div className="flex justify-end">
                <SkeletonBox className="h-4 w-28 rounded" />
              </div>
              <div className="flex justify-end">
                <SkeletonBox className="h-4 w-20 rounded" />
              </div>
              <div className="flex justify-end">
                <SkeletonBox className="h-4 w-16 rounded" />
              </div>
            </div>
          </div>
          {i < rows - 1 ? <div className={SCREENER_TABLE_STROKE_INSET_CLASS} aria-hidden /> : null}
        </div>
      ))}
    </ScreenerTableScroll>
  );
}

function SuperinvestorRow({
  position,
  showDivider,
}: {
  position: SuperinvestorPosition;
  showDivider: boolean;
}) {
  return (
    <div className={SCREENER_TABLE_DATA_ROW_CLASS}>
      <div className={SUPERINVESTOR_ROW_PAD_CLASS}>
        <Link
          href={`/superinvestors/${encodeURIComponent(position.superinvestorSlug)}`}
          prefetch={false}
          className={cn(
            SUPERINVESTOR_GRID,
            "min-h-[60px] no-underline text-[#141414] visited:text-[#141414]",
            SCREENER_TABLE_ROW_HOVER_SURFACE_CLASS,
          )}
        >
          <div className="flex min-w-0 items-center gap-3 pr-2">
            {position.avatarSrc ? (
              <span className="relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full border border-[#EBEBEC] bg-[#F4F4F5] ring-1 ring-white">
                <Image
                  src={position.avatarSrc}
                  alt={position.managerName}
                  width={40}
                  height={40}
                  className="object-cover"
                  sizes="40px"
                />
              </span>
            ) : (
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#EBEBEC] bg-[#F4F4F5] text-[#5C5D5F]">
                {position.managerName.trim().slice(0, 2).toUpperCase()}
              </span>
            )}
            <div className="min-w-0">
              <div className="truncate text-[14px] font-semibold leading-5 text-[#141414] underline-offset-[3px] decoration-[#141414] group-hover/row:underline">
                {position.managerName}
              </div>
              <div className="truncate text-[12px] font-normal leading-4 text-[#5C5D5F]">{position.fundName}</div>
            </div>
          </div>

          <div className="text-right font-['Inter'] text-[14px] font-normal tabular-nums text-[#141414]">
            {pct.format(position.weightPct)}%
          </div>

          <div className="text-right text-[14px] leading-5">
            <ActivityCell label={position.statusLabel} />
          </div>

          <div className="text-right font-['Inter'] text-[14px] font-normal tabular-nums text-[#141414]">
            {position.shares != null ? formatSharesCompact(position.shares) : "—"}
          </div>

          <div className="text-right font-['Inter'] text-[14px] font-normal tabular-nums text-[#141414]">
            {formatUsdCompactSigDigits(position.valueUsd, 4)}
          </div>
        </Link>
      </div>
      {showDivider ? <div className={SCREENER_TABLE_STROKE_INSET_CLASS} aria-hidden /> : null}
    </div>
  );
}

export function StockSuperinvestorsTab({ ticker }: { ticker: string }) {
  const [loading, setLoading] = useState(true);
  const [payload, setPayload] = useState<Payload | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const res = await fetch(`/api/stocks/${encodeURIComponent(ticker)}/superinvestors`);
        if (!res.ok) {
          if (!cancelled) setPayload({ ticker, positions: [] });
          return;
        }
        const json = (await res.json()) as Payload;
        if (!cancelled) setPayload(json);
      } catch {
        if (!cancelled) setPayload({ ticker, positions: [] });
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [ticker]);

  const positions = payload?.positions ?? [];
  const sorted = useMemo(() => [...positions].sort((a, b) => b.weightPct - a.weightPct), [positions]);

  if (loading) {
    return (
      <div className="space-y-5">
        <h2 className={STOCK_OVERVIEW_SECTION_HEADING_CLASS}>Superinvestors</h2>
        <SuperinvestorsTableSkeleton rows={3} />
      </div>
    );
  }

  if (sorted.length === 0) {
    return (
      <div className="space-y-5">
        <h2 className={STOCK_OVERVIEW_SECTION_HEADING_CLASS}>Superinvestors</h2>
        <Empty variant="card" className="min-h-[min(40vh,360px)]">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Landmark className="h-6 w-6" strokeWidth={1.75} aria-hidden />
            </EmptyMedia>
            <EmptyTitle>No superinvestor holdings</EmptyTitle>
            <EmptyDescription>
              None of the tracked superinvestors currently hold this company in their latest 13F filings.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <h2 className={STOCK_OVERVIEW_SECTION_HEADING_CLASS}>Superinvestors</h2>

      <ScreenerTableScroll mobileScroll>
        <SuperinvestorsTableHeader />
        {sorted.map((p, i) => (
          <SuperinvestorRow
            key={`${p.superinvestorSlug}-${p.managerName}`}
            position={p}
            showDivider={i < sorted.length - 1}
          />
        ))}
      </ScreenerTableScroll>
    </div>
  );
}
