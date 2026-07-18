"use client";

import Image from "next/image";
import Link from "next/link";
import { Landmark } from "@/lib/icons";
import { useEffect, useMemo, useState } from "react";

import { SkeletonBox } from "@/components/markets/skeleton";
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

function ActivityCell({ label }: { label: string | null }) {
  if (!label) return <span className="text-[#71717A]">—</span>;
  const lower = label.toLowerCase();
  const down = lower.startsWith("reduce") || lower.startsWith("sold");
  const up = lower.startsWith("increase") || lower.startsWith("buy") || lower.startsWith("new");
  return (
    <span className={cn("font-medium", up ? "text-[#16A34A]" : down ? "text-[#DC2626]" : "text-[#71717A]")}>
      {label}
    </span>
  );
}

function SuperinvestorsTableSkeleton({ rows = 3 }: { rows?: number }) {
  const grid =
    "grid min-h-[60px] w-full grid-cols-[minmax(220px,2.4fr)_minmax(88px,0.9fr)_minmax(140px,1.2fr)_minmax(110px,1fr)_minmax(110px,1fr)] items-center gap-x-4 bg-white px-2 sm:px-4";
  const headerGrid =
    "grid h-11 min-h-[44px] w-full grid-cols-[minmax(220px,2.4fr)_minmax(88px,0.9fr)_minmax(140px,1.2fr)_minmax(110px,1fr)_minmax(110px,1fr)] items-center gap-x-4 bg-white px-2 text-[14px] font-medium leading-5 text-[#71717A] sm:px-4";

  return (
    <div className="-mx-1 overflow-x-auto overscroll-x-contain rounded-lg border border-[#E4E4E7] [-webkit-overflow-scrolling:touch] sm:-mx-0 sm:rounded-none sm:border-x-0 sm:border-t sm:border-b">
      <div className="min-w-[760px] lg:min-w-0">
        <div className="divide-y divide-[#E4E4E7] bg-white">
          <div className={headerGrid} aria-hidden>
            <div className="text-left">Manager / Fund</div>
            <div className="text-right">% of portfolio</div>
            <div className="text-right">Recent activity</div>
            <div className="text-right">Shares</div>
            <div className="text-right">Value</div>
          </div>

          {Array.from({ length: rows }, (_, i) => (
            <div key={i} className={cn(grid, "animate-pulse")} aria-hidden>
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
          ))}
        </div>
      </div>
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
      <div className="space-y-6 pt-1">
        <h2 className="text-[20px] font-semibold leading-8 tracking-tight text-[#0F0F0F]">Superinvestors</h2>
        <SuperinvestorsTableSkeleton rows={3} />
      </div>
    );
  }

  if (sorted.length === 0) {
    return (
      <div className="space-y-6 pt-1">
        <h2 className="text-[20px] font-semibold leading-8 tracking-tight text-[#0F0F0F]">Superinvestors</h2>
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
    <div className="space-y-6 pt-1">
      <h2 className="text-[20px] font-semibold leading-8 tracking-tight text-[#0F0F0F]">Superinvestors</h2>

      <div className="-mx-1 overflow-x-auto overscroll-x-contain rounded-lg border border-[#E4E4E7] [-webkit-overflow-scrolling:touch] sm:-mx-0 sm:rounded-none sm:border-x-0 sm:border-t sm:border-b">
        <div className="min-w-[760px] lg:min-w-0">
          <div className="divide-y divide-[#E4E4E7] bg-white">
            <div className="grid h-11 min-h-[44px] w-full grid-cols-[minmax(220px,2.4fr)_minmax(88px,0.9fr)_minmax(140px,1.2fr)_minmax(110px,1fr)_minmax(110px,1fr)] items-center gap-x-4 bg-white px-2 text-[14px] font-medium leading-5 text-[#71717A] sm:px-4">
              <div className="text-left">Manager / Fund</div>
              <div className="text-right">% of portfolio</div>
              <div className="text-right">Recent activity</div>
              <div className="text-right">Shares</div>
              <div className="text-right">Value</div>
            </div>

            {sorted.map((p) => (
              <Link
                key={`${p.superinvestorSlug}-${p.managerName}`}
                href={`/superinvestors/${encodeURIComponent(p.superinvestorSlug)}`}
                prefetch={false}
                className="group grid min-h-[60px] w-full grid-cols-[minmax(220px,2.4fr)_minmax(88px,0.9fr)_minmax(140px,1.2fr)_minmax(110px,1fr)_minmax(110px,1fr)] items-center gap-x-4 bg-white px-2 transition-colors duration-75 hover:bg-neutral-50 sm:px-4"
              >
                <div className="flex min-w-0 items-center gap-3 pr-2">
                  {p.avatarSrc ? (
                    <span className="relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full border border-[#E4E4E7] bg-[#F4F4F5] ring-1 ring-white">
                      <Image src={p.avatarSrc} alt={p.managerName} width={40} height={40} className="object-cover" sizes="40px" />
                    </span>
                  ) : (
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#E4E4E7] bg-[#F4F4F5] text-[#71717A]">
                      {p.managerName.trim().slice(0, 2).toUpperCase()}
                    </span>
                  )}
                  <div className="min-w-0">
                    <div className="truncate text-[14px] font-semibold leading-5 text-[#0F0F0F] underline-offset-[3px] decoration-[#0F0F0F] group-hover:underline">
                      {p.managerName}
                    </div>
                    <div className="truncate text-[12px] font-normal leading-4 text-[#71717A]">{p.fundName}</div>
                  </div>
                </div>

                <div className="text-right font-['Inter'] text-[14px] font-medium tabular-nums text-[#0F0F0F]">
                  {pct.format(p.weightPct)}%
                </div>

                <div className="text-right text-[14px] leading-5">
                  <ActivityCell label={p.statusLabel} />
                </div>

                <div className="text-right font-['Inter'] text-[14px] font-normal tabular-nums text-[#0F0F0F]">
                  {p.shares != null ? formatSharesCompact(p.shares) : "—"}
                </div>

                <div className="text-right font-['Inter'] text-[14px] font-normal tabular-nums text-[#0F0F0F]">
                  {formatUsdCompactSigDigits(p.valueUsd, 4)}
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

