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

const cellUp = "text-up";
const cellDown = "text-down";

export const superinvestorTxTdActivity =
  "flex min-w-0 flex-col items-end justify-center py-1 text-right text-[14px] leading-5 whitespace-normal";

export const superinvestorTxTdNum =
  "whitespace-nowrap py-0 text-right align-middle font-['Inter'] text-[14px] font-normal leading-5 tabular-nums text-fg";

export const superinvestorTxRowGridThree =
  "grid w-full min-w-[520px] grid-cols-[minmax(140px,1.15fr)_minmax(96px,0.9fr)_minmax(120px,1.05fr)] gap-x-4";

/** Signed share delta for the Shares column (header already says “Shares”). */
export function formatSuperinvestorSharesDelta(n: number | null): string {
  if (n == null || n === 0 || !Number.isFinite(n)) return "—";
  const sign = n < 0 ? "-" : "+";
  const abs = Math.abs(n);
  if (abs >= 1e9) return `${sign}${(abs / 1e9).toFixed(1)}B`;
  if (abs >= 1e6) return `${sign}${(abs / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `${sign}${(abs / 1e3).toFixed(1)}K`;
  return `${sign}${abs.toLocaleString("en-US")}`;
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

/** Action + % only (share delta lives in the Shares column). */
export function SuperinvestorTransactionActivityCell({ tx }: { tx: SuperinvestorQuarterlyTransaction }) {
  const line1 = superinvestorTransactionActivityHeadline(tx.kind, tx.sharesChangePct, tx.sharesDelta);
  const color = activityTextColor(tx.kind);

  return (
    <span className={cn("text-[14px] font-semibold leading-5 tabular-nums", color)}>{line1}</span>
  );
}

export function SuperinvestorTransactionSharesAndWeightCells({
  tx,
}: {
  tx: SuperinvestorQuarterlyTransaction;
}) {
  return (
    <>
      <div className={superinvestorTxTdNum}>{formatSuperinvestorSharesDelta(tx.sharesDelta)}</div>
      <div className={superinvestorTxTdNum}>
        {formatSuperinvestorPortfolioWeightChange(tx.portfolioWeightChangePct)}
      </div>
    </>
  );
}
