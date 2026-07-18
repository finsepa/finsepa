"use client";

import type { SuperinvestorQuarterlyTransaction, SuperinvestorQuarterlyTransactionKind } from "@/lib/superinvestors/types";
import { superinvestorTransactionActivityHeadline } from "@/lib/superinvestors/superinvestor-transaction-utils";
import { cn } from "@/lib/utils";

const priceFmt = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const cellUp = "text-[#16A34A]";
const cellDown = "text-[#DC2626]";

export const superinvestorTxTdActivity =
  "flex min-w-0 flex-col items-end justify-center py-1 text-right text-[14px] leading-5 whitespace-normal";

export const superinvestorTxTdNum =
  "whitespace-nowrap py-0 text-right align-middle font-['Inter'] text-[14px] font-normal leading-5 tabular-nums text-[#0F0F0F]";

export const superinvestorTxRowGridThree =
  "grid w-full min-w-[520px] grid-cols-[minmax(140px,1.15fr)_minmax(96px,0.9fr)_minmax(120px,1.05fr)] gap-x-4";

const tickerSublineClass = "text-[12px] font-normal leading-4 tabular-nums text-[#71717A]";

function formatSharesDeltaLine(n: number | null): string | null {
  if (n == null || n === 0 || !Number.isFinite(n)) return null;
  const sign = n < 0 ? "-" : "+";
  const abs = Math.abs(n);
  if (abs >= 1e9) return `${sign}${(abs / 1e9).toFixed(1)}B shares`;
  if (abs >= 1e6) return `${sign}${(abs / 1e6).toFixed(1)}M shares`;
  if (abs >= 1e3) return `${sign}${(abs / 1e3).toFixed(1)}K shares`;
  return `${sign}${abs.toLocaleString("en-US")} shares`;
}

function activityLines(tx: SuperinvestorQuarterlyTransaction): { line1: string; line2: string | null } {
  const shares = formatSharesDeltaLine(tx.sharesDelta);
  return {
    line1: superinvestorTransactionActivityHeadline(tx.kind, tx.sharesChangePct, tx.sharesDelta),
    line2: shares,
  };
}

function activityTextColor(kind: SuperinvestorQuarterlyTransactionKind): string {
  if (kind === "buy" || kind === "new") return cellUp;
  return cellDown;
}

export function formatSuperinvestorTxPrice(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return priceFmt.format(n);
}

export function formatSuperinvestorTxPriceRange(low: number | null, high: number | null): string {
  if (low == null || high == null || !Number.isFinite(low) || !Number.isFinite(high)) return "—";
  if (Math.abs(low - high) < 0.005) return formatSuperinvestorTxPrice(low);
  return `${formatSuperinvestorTxPrice(low)} - ${formatSuperinvestorTxPrice(high)}`;
}

const portfolioWeightFmt = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Portfolio weight delta in percentage points (Dataroma-style). */
export function formatSuperinvestorPortfolioWeightChange(pct: number | null): string {
  if (pct == null || !Number.isFinite(pct)) return "—";
  return portfolioWeightFmt.format(Math.abs(pct));
}

export function SuperinvestorTransactionActivityCell({ tx }: { tx: SuperinvestorQuarterlyTransaction }) {
  const { line1, line2 } = activityLines(tx);
  const color = activityTextColor(tx.kind);

  return (
    <div className="flex flex-col items-end gap-0.5">
      <span className={cn("text-[14px] font-semibold leading-5 tabular-nums", color)}>{line1}</span>
      {line2 ? <span className={tickerSublineClass}>{line2}</span> : null}
    </div>
  );
}

export function SuperinvestorTransactionPriceCells({ tx }: { tx: SuperinvestorQuarterlyTransaction }) {
  return (
    <>
      <div className={superinvestorTxTdNum}>{formatSuperinvestorTxPrice(tx.avgClosingPriceUsd)}</div>
      <div className={superinvestorTxTdNum}>
        {formatSuperinvestorPortfolioWeightChange(tx.portfolioWeightChangePct)}
      </div>
    </>
  );
}
