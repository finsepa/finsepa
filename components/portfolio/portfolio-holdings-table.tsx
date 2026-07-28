"use client";

import { ArrowDown, ArrowUp, ChevronDown, ChevronUp } from "@/lib/icons";
import { Fragment, memo, startTransition, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import type { CompanyPick } from "@/components/charting/company-picker";
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
import { HoldingRowActionsMenu } from "@/components/portfolio/holding-row-actions-menu";
import { PortfolioHoldingTransactionsPanel } from "@/components/portfolio/portfolio-holding-transactions-panel";
import { displayLogoUrlForPortfolioSymbol } from "@/lib/portfolio/portfolio-asset-display-logo";
import { RemoveAssetModal } from "@/components/portfolio/remove-asset-modal";
import { usePortfolioWorkspace } from "@/components/portfolio/portfolio-workspace-context";
import {
  portfolioHoldingAssetHref,
  type PortfolioHoldingAssetLinkTab,
} from "@/lib/crypto/crypto-picker-universe";
import {
  portfolioAssetSymbolCaption,
  portfolioSharesUnitTicker,
} from "@/lib/portfolio/custom-asset-symbol";
import { netCashUsd } from "@/lib/portfolio/overview-metrics";
import { cumulativeRealizedGainUsdForAsset } from "@/lib/portfolio/realized-pnl-from-trades";
import { cryptoRouteBase } from "@/lib/crypto/crypto-symbol-base";
import { isSupportedCryptoAssetSymbol } from "@/lib/crypto/crypto-logo-url";
import { formatPortfolioUsdPerUnit } from "@/lib/portfolio/format-portfolio-usd-unit";
import {
  portfolioHoldingDisplayName,
  usePortfolioHoldingDisplayNames,
} from "@/lib/portfolio/use-portfolio-holding-display-names";
import { cn } from "@/lib/utils";
import type { PortfolioHolding, PortfolioTransaction } from "@/components/portfolio/portfolio-types";

const EM_DASH = "\u2014";

/** Matches screener company column (`screener-table.tsx`). */
const HOLDING_COMPANY_NAME_CLASS =
  "truncate text-[14px] font-semibold leading-5 text-[#141414] underline-offset-2 decoration-[#5C5D5F] group-hover:underline group-hover/row:underline";

/** Desktop holdings columns — expand + asset + numerics (+ actions). Fluid so card 8px inset isn’t clipped. */
const HOLDINGS_GRID_BASE =
  "grid w-full min-w-0 items-center gap-x-2 grid-cols-[40px_minmax(0,2.2fr)_minmax(0,0.9fr)_minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,1.2fr)_minmax(0,0.85fr)]";
const HOLDINGS_GRID_WITH_ACTIONS =
  "grid w-full min-w-0 items-center gap-x-2 grid-cols-[40px_minmax(0,2.2fr)_minmax(0,0.9fr)_minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,1.2fr)_minmax(0,0.85fr)_52px]";

/** Expand/collapse control for inline transaction history. */
function PortfolioHoldingExpandButton({
  expanded,
  onToggle,
}: {
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      data-holding-expand
      aria-label={expanded ? "Collapse transactions" : "Show transactions"}
      aria-expanded={expanded}
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      className={cn(
        "inline-flex h-7 w-7 items-center justify-center rounded-full border border-transparent bg-transparent text-[#141414]",
        "transition-colors hover:bg-[#F4F4F5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#141414]/15",
        expanded && "bg-[#F4F4F5]",
      )}
    >
      {expanded ?
        <ChevronUp className="h-4 w-4" strokeWidth={2} aria-hidden />
      : <ChevronDown className="h-4 w-4" strokeWidth={2} aria-hidden />}
    </button>
  );
}

function holdingToCompanyPick(h: PortfolioHolding): CompanyPick {
  const cryptoKey = cryptoRouteBase(h.symbol);
  const symbol =
    isSupportedCryptoAssetSymbol(cryptoKey) ? cryptoKey : h.symbol.trim().toUpperCase();
  return { symbol, name: h.name };
}

const PNL_BREAKDOWN_TOOLTIP_W = 240;
/** Offset from pointer so the tooltip sits just beside the cursor. */
const PNL_CURSOR_OFFSET = 10;
const PNL_BREAKDOWN_VIEW_PAD = 12;
/** Approximate tooltip height for viewport clamping (no layout read). */
const PNL_TOOLTIP_APPROX_H = 132;

function pnlBreakdownTooltipNearPointer(clientX: number, clientY: number): { left: number; top: number } {
  const vw = typeof window !== "undefined" ? window.innerWidth : 1200;
  const vh = typeof window !== "undefined" ? window.innerHeight : 800;
  const pad = PNL_BREAKDOWN_VIEW_PAD;
  const w = PNL_BREAKDOWN_TOOLTIP_W;
  const h = PNL_TOOLTIP_APPROX_H;

  let left = clientX + PNL_CURSOR_OFFSET;
  let top = clientY + PNL_CURSOR_OFFSET;
  if (left + w > vw - pad) left = clientX - w - PNL_CURSOR_OFFSET;
  if (top + h > vh - pad) top = clientY - h - PNL_CURSOR_OFFSET;
  left = Math.max(pad, Math.min(left, vw - pad - w));
  top = Math.max(pad, Math.min(top, vh - pad - h));
  return { left, top };
}

function PortfolioPnlBreakdownTooltip({
  totalUsd,
  totalPct,
  unrealizedUsd,
  realizedUsd,
}: {
  /** Unrealized + realized (matches tooltip Total line). */
  totalUsd: number;
  /** Total return % vs current position cost basis (same as asset detail “Total profit”). */
  totalPct: number;
  unrealizedUsd: number;
  realizedUsd: number;
}) {
  const triggerRef = useRef<HTMLDivElement>(null);
  const lastPointerRef = useRef({ x: 0, y: 0 });
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ left: 0, top: 0 });
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const repositionFromStoredPointer = useCallback(() => {
    const { x, y } = lastPointerRef.current;
    setPos(pnlBreakdownTooltipNearPointer(x, y));
  }, []);

  const show = useCallback((e: React.MouseEvent) => {
    lastPointerRef.current = { x: e.clientX, y: e.clientY };
    setPos(pnlBreakdownTooltipNearPointer(e.clientX, e.clientY));
    setOpen(true);
  }, []);

  const onPointerMove = useCallback((e: React.MouseEvent) => {
    lastPointerRef.current = { x: e.clientX, y: e.clientY };
    setPos(pnlBreakdownTooltipNearPointer(e.clientX, e.clientY));
  }, []);

  const hide = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    repositionFromStoredPointer();
    window.addEventListener("scroll", repositionFromStoredPointer, true);
    window.addEventListener("resize", repositionFromStoredPointer);
    return () => {
      window.removeEventListener("scroll", repositionFromStoredPointer, true);
      window.removeEventListener("resize", repositionFromStoredPointer);
    };
  }, [open, repositionFromStoredPointer]);

  const tooltip =
    open && mounted ? (
      <div
        className="pointer-events-none fixed z-[200] w-[240px] rounded-[10px] border border-[#E4E4E7] bg-white px-3 py-2 text-left text-[12px] leading-4 text-[#141414] shadow-[0px_8px_20px_0px_rgba(10,10,10,0.10)]"
        style={{ left: pos.left, top: pos.top }}
        role="tooltip"
      >
        <div className="font-semibold text-[#141414]">Profit/Loss</div>
        <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1">
          <div className="text-[#5C5D5F]">Unrealized</div>
          <div className={cn("text-right tabular-nums", unrealizedUsd >= 0 ? "text-[#16A34A]" : "text-[#DC2626]")}>
            {formatSignedUsd(unrealizedUsd)}
          </div>
          <div className="text-[#5C5D5F]">Realized</div>
          <div className={cn("text-right tabular-nums", realizedUsd >= 0 ? "text-[#16A34A]" : "text-[#DC2626]")}>
            {formatSignedUsd(realizedUsd)}
          </div>
          <div className="text-[#5C5D5F]">Total</div>
          <div className={cn("text-right tabular-nums font-semibold", totalUsd >= 0 ? "text-[#16A34A]" : "text-[#DC2626]")}>
            {formatSignedUsd(totalUsd)}
          </div>
        </div>
      </div>
    ) : null;

  return (
    <>
      <div
        ref={triggerRef}
        className="inline-flex w-full cursor-default flex-col items-end"
        onMouseEnter={show}
        onMouseMove={onPointerMove}
        onMouseLeave={hide}
      >
        <div
          className={cn(
            "font-['Inter'] text-[14px] font-semibold leading-5 tabular-nums",
            totalUsd >= 0 ? "text-[#16A34A]" : "text-[#DC2626]",
          )}
        >
          {formatSignedUsd(totalUsd)}
        </div>
        <div
          className={cn(
            "text-[12px] font-medium leading-4 tabular-nums",
            totalPct >= 0 ? "text-[#16A34A]" : "text-[#DC2626]",
          )}
        >
          {formatSignedPct(totalPct)}
        </div>
      </div>
      {mounted && tooltip ? createPortal(tooltip, document.body) : null}
    </>
  );
}

const usd0 = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const pct = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
/** Position size — truncate to 2 decimal places (not round); always show two fractional digits. */
function formatSharesDisplay(n: number): string {
  if (!Number.isFinite(n)) return "";
  const truncated = Math.trunc(n * 100) / 100;
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(truncated);
}

function formatSharesWithUnit(shares: number, symbol: string): string {
  const qty = formatSharesDisplay(shares);
  const unit = portfolioSharesUnitTicker(symbol);
  return unit ? `${qty} ${unit}` : qty;
}

function formatSharesAsShares(shares: number): string {
  const qty = formatSharesDisplay(shares);
  return `${qty} shares`;
}

function formatSignedUsd(n: number): string {
  const s = usd0.format(Math.abs(n));
  return n >= 0 ? `+${s}` : `-${s}`;
}

function formatSignedPct(n: number): string {
  const s = pct.format(Math.abs(n));
  return n >= 0 ? `+${s}%` : `-${s}%`;
}

type HoldingsSortKey = "holdings" | "pnl" | "weight";

type HoldingTableRow = {
  holding: PortfolioHolding;
  retUsd: number;
  totalPnlUsd: number;
  weightPct: number;
};

function compareHoldingTableRows(a: HoldingTableRow, b: HoldingTableRow, key: HoldingsSortKey, dir: number): number {
  if (key === "holdings") return (a.holding.currentValue - b.holding.currentValue) * dir;
  if (key === "pnl") return (a.totalPnlUsd - b.totalPnlUsd) * dir;
  return (a.weightPct - b.weightPct) * dir;
}

function HoldingsSortHeader({
  label,
  sortKey,
  activeKey,
  dir,
  onSort,
}: {
  label: string;
  sortKey: HoldingsSortKey;
  activeKey: HoldingsSortKey;
  dir: "asc" | "desc";
  onSort: (key: HoldingsSortKey) => void;
}) {
  const active = activeKey === sortKey;
  return (
    <div className={cn("min-w-0 w-full text-right", TABLE_END_ALIGNED_PAD_CLASS)}>
      <button
        type="button"
        className="inline-flex w-full items-center justify-end gap-1 rounded text-[14px] font-medium leading-5 text-[#5C5D5F] hover:text-[#141414]"
        onClick={() => onSort(sortKey)}
        aria-label={`Sort by ${label}`}
      >
        {label}
        {active ?
          dir === "desc" ?
            <ArrowDown className="h-3.5 w-3.5 shrink-0" aria-hidden />
          : <ArrowUp className="h-3.5 w-3.5 shrink-0" aria-hidden />
        : null}
      </button>
    </div>
  );
}

function PortfolioHoldingsTableInner({
  holdings,
  transactions,
  className,
  assetLinkTab = "holdings",
}: {
  holdings: PortfolioHolding[];
  transactions: PortfolioTransaction[];
  className?: string;
  /** Public portfolio views link to asset Overview; editable portfolios open Portfolio tab. */
  assetLinkTab?: PortfolioHoldingAssetLinkTab;
}) {
  const {
    selectedPortfolioId,
    transactionsByPortfolioId,
    setPortfolioHoldings,
    setPortfolioTransactions,
    editTransaction,
    closeEditTransaction,
    selectedPortfolioReadOnly,
    openNewTransactionWithPreset,
  } = usePortfolioWorkspace();

  const [removeTarget, setRemoveTarget] = useState<PortfolioHolding | null>(null);
  const [openActionsHoldingId, setOpenActionsHoldingId] = useState<string | null>(null);
  const [expandedHoldingId, setExpandedHoldingId] = useState<string | null>(null);
  const [sort, setSort] = useState<{ key: HoldingsSortKey; dir: "asc" | "desc" }>({
    key: "weight",
    dir: "desc",
  });
  const resolvedCompanyNames = usePortfolioHoldingDisplayNames(holdings);
  const router = useRouter();

  const toggleExpandedHolding = useCallback((holdingId: string) => {
    setExpandedHoldingId((cur) => (cur === holdingId ? null : holdingId));
  }, []);

  const onSort = useCallback((key: HoldingsSortKey) => {
    setSort((s) =>
      s.key === key ? { key, dir: s.dir === "desc" ? "asc" : "desc" } : { key, dir: "desc" },
    );
  }, []);

  const holdingsGridClass = selectedPortfolioReadOnly ? HOLDINGS_GRID_BASE : HOLDINGS_GRID_WITH_ACTIONS;

  const confirmRemoveAsset = useCallback(() => {
    if (!selectedPortfolioId || !removeTarget) return;
    const pid = selectedPortfolioId;
    const sym = removeTarget.symbol.toUpperCase();
    const assetLabel = `${removeTarget.name} (${removeTarget.symbol})`;
    const nextHoldings = holdings.filter((h) => h.id !== removeTarget.id);
    const txs = transactionsByPortfolioId[pid] ?? [];
    const nextTx = txs.filter((t) => t.symbol.toUpperCase() !== sym);

    if (
      editTransaction &&
      editTransaction.portfolioId === pid &&
      editTransaction.symbol.toUpperCase() === sym
    ) {
      closeEditTransaction();
    }

    startTransition(() => {
      setPortfolioHoldings(pid, nextHoldings);
      setPortfolioTransactions(pid, nextTx);
    });
    toast.success(`${assetLabel} removed from portfolio.`);
    setRemoveTarget(null);
  }, [
    selectedPortfolioId,
    removeTarget,
    holdings,
    transactionsByPortfolioId,
    setPortfolioHoldings,
    setPortfolioTransactions,
    editTransaction,
    closeEditTransaction,
  ]);

  const cashUsd = netCashUsd(transactions);
  const equityValue = holdings.reduce((s, h) => s + h.currentValue, 0);
  // Allocation display: if cash is negative, exclude it from the denominator so weights stay within 0–100%.
  const allocationDenomUsd = equityValue + Math.max(0, cashUsd);
  const cashWeightPct = allocationDenomUsd > 0 && cashUsd > 0 ? (cashUsd / allocationDenomUsd) * 100 : 0;

  const rows = useMemo((): HoldingTableRow[] => {
    return holdings.map((h) => {
      const retUsd = h.currentValue - h.costBasis;
      const cryptoKey = cryptoRouteBase(h.symbol);
      const assetKind: "stock" | "crypto" =
        isSupportedCryptoAssetSymbol(cryptoKey) ? "crypto" : "stock";
      const realizedUsd = cumulativeRealizedGainUsdForAsset(transactions, cryptoKey, assetKind);
      const weightRaw = allocationDenomUsd > 0 ? (h.currentValue / allocationDenomUsd) * 100 : 0;
      const weightPct = Math.min(100, Math.max(0, weightRaw));
      return { holding: h, retUsd, totalPnlUsd: retUsd + realizedUsd, weightPct };
    });
  }, [holdings, transactions, allocationDenomUsd]);

  const sorted = useMemo(() => {
    const dir = sort.dir === "desc" ? -1 : 1;
    return [...rows].sort((a, b) => compareHoldingTableRows(a, b, sort.key, dir));
  }, [rows, sort]);

  return (
    <>
      <RemoveAssetModal
        holding={removeTarget}
        onClose={() => setRemoveTarget(null)}
        onConfirmRemove={confirmRemoveAsset}
      />
      <div className={cn("w-full max-md:pb-4 sm:pb-2", className)}>
      <div className="sm:hidden">
        <div>
          {sorted.map(({ holding: h, retUsd }) => {
            const cryptoKey = cryptoRouteBase(h.symbol);
            const assetKind: "stock" | "crypto" =
              isSupportedCryptoAssetSymbol(cryptoKey) ? "crypto" : "stock";
            const realizedUsd = cumulativeRealizedGainUsdForAsset(transactions, cryptoKey, assetKind);
            const unrealizedUsd = retUsd;
            const totalUsd = unrealizedUsd + realizedUsd;
            const totalPct = h.costBasis > 0 ? (totalUsd / h.costBasis) * 100 : 0;
            const assetHref = portfolioHoldingAssetHref(h.symbol, { tab: assetLinkTab });
            const logo = displayLogoUrlForPortfolioSymbol(h.symbol);
            const caption = portfolioAssetSymbolCaption(h.symbol);
            const companyName = portfolioHoldingDisplayName(h, resolvedCompanyNames);

            const left = (
              <div className="flex min-w-0 items-center gap-3">
                <CompanyLogo name={companyName} logoUrl={logo} symbol={h.symbol} />
                <div className="min-w-0">
                  <div className={HOLDING_COMPANY_NAME_CLASS}>{companyName}</div>
                  <div className="truncate text-[12px] font-normal leading-4 text-[#5C5D5F]">
                    {caption} · {formatSharesAsShares(h.shares)}
                  </div>
                </div>
              </div>
            );

            const right = (
              <div className="min-w-0 text-right">
                <div className="font-['Inter'] text-[14px] font-semibold leading-5 tabular-nums text-[#141414]">
                  {usd0.format(h.currentValue)}
                </div>
                <div
                  className={cn(
                    "mt-0.5 truncate text-[12px] font-medium leading-4 tabular-nums",
                    totalUsd >= 0 ? "text-[#16A34A]" : "text-[#DC2626]",
                  )}
                >
                  {formatSignedUsd(totalUsd)} ({formatSignedPct(totalPct)})
                </div>
              </div>
            );

            return (
              <div
                key={h.id}
                className="group relative flex min-h-[60px] min-w-0 items-center justify-between gap-3 bg-white px-4 py-3 transition-colors duration-75 hover:bg-neutral-50 sm:py-4"
              >
                {assetHref ? (
                  <Link
                    href={assetHref}
                    className="absolute inset-0 z-0 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-[#141414]/15 focus-visible:ring-offset-2"
                    aria-label={`Open ${companyName}`}
                  />
                ) : null}
                <div className="relative z-[1] min-w-0 flex-1">{left}</div>
                <div className="relative z-[1] shrink-0">{right}</div>
              </div>
            );
          })}

          <div className="flex min-h-[60px] min-w-0 items-center justify-between gap-3 bg-white px-4 py-3 sm:py-4">
            <div className="flex min-w-0 items-center gap-3">
              <CompanyLogo name="US Dollar" logoUrl="" symbol="USD" />
              <div className="min-w-0">
                <div className="truncate text-[14px] font-semibold leading-5 text-[#141414]">US Dollar</div>
                <div className="truncate text-[12px] font-normal leading-4 text-[#5C5D5F]">
                  USD · {formatSharesDisplay(cashUsd)} USD
                </div>
              </div>
            </div>
            <div className="min-w-0 text-right">
              <div className="font-['Inter'] text-[14px] font-semibold leading-5 tabular-nums text-[#141414]">
                {usd0.format(cashUsd)}
              </div>
              <div className="mt-0.5 truncate text-[12px] font-medium leading-4 tabular-nums text-[#5C5D5F]">
                {EM_DASH}
              </div>
            </div>
          </div>
        </div>
      </div>


      <div className="hidden sm:block">
        <ScreenerTableScroll className="sm:pb-6">
          <div className="bg-white">
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
                  className={cn(
                    holdingsGridClass,
                    "min-h-[44px] text-[14px] font-medium leading-5 text-[#5C5D5F]",
                  )}
                >
                  <div aria-hidden />
                  <div className={cn("text-left", TABLE_START_ALIGNED_PAD_CLASS)}>Asset</div>
                  <div className={cn("min-w-0 w-full text-right", TABLE_END_ALIGNED_PAD_CLASS)}>Price</div>
                  <HoldingsSortHeader
                    label="Holdings"
                    sortKey="holdings"
                    activeKey={sort.key}
                    dir={sort.dir}
                    onSort={onSort}
                  />
                  <div className={cn("min-w-0 w-full text-right", TABLE_END_ALIGNED_PAD_CLASS)}>
                    Avg. Buy Price
                  </div>
                  <HoldingsSortHeader
                    label="Profit/Loss"
                    sortKey="pnl"
                    activeKey={sort.key}
                    dir={sort.dir}
                    onSort={onSort}
                  />
                  <HoldingsSortHeader
                    label="Weight"
                    sortKey="weight"
                    activeKey={sort.key}
                    dir={sort.dir}
                    onSort={onSort}
                  />
                  {!selectedPortfolioReadOnly ? (
                    <div className={cn("w-full text-right", TABLE_END_ALIGNED_PAD_CLASS)} aria-label="Actions" />
                  ) : null}
                </div>
              </div>
              <div className={SCREENER_TABLE_STROKE_INSET_CLASS} aria-hidden />
            </div>

            {sorted.map(({ holding: h, retUsd, weightPct }) => {
              const cryptoKey = cryptoRouteBase(h.symbol);
              const assetKind: "stock" | "crypto" =
                isSupportedCryptoAssetSymbol(cryptoKey) ? "crypto" : "stock";
              const realizedUsd = cumulativeRealizedGainUsdForAsset(transactions, cryptoKey, assetKind);
              const unrealizedUsd = retUsd;
              const totalUsd = unrealizedUsd + realizedUsd;
              const totalPct = h.costBasis > 0 ? (totalUsd / h.costBasis) * 100 : 0;
              const assetHref = portfolioHoldingAssetHref(h.symbol, { tab: assetLinkTab });
              const logo = displayLogoUrlForPortfolioSymbol(h.symbol);
              const caption = portfolioAssetSymbolCaption(h.symbol);
              const companyName = portfolioHoldingDisplayName(h, resolvedCompanyNames);
              const expanded = expandedHoldingId === h.id;

              return (
                <Fragment key={h.id}>
                  <div className={SCREENER_TABLE_DATA_ROW_CLASS}>
                    <div className={DEFAULT_TABLE_ROW_HOVER_PAD_CLASS}>
                      <div
                        className={cn(
                          holdingsGridClass,
                          "min-h-[56px] text-[14px] font-normal leading-5",
                          SCREENER_TABLE_ROW_HOVER_SURFACE_CLASS,
                          assetHref && !expanded && "cursor-pointer",
                        )}
                        onClick={
                          assetHref
                            ? (e) => {
                                if ((e.target as HTMLElement).closest("[data-holding-actions]")) return;
                                if ((e.target as HTMLElement).closest("[data-holding-expand]")) return;
                                if ((e.target as HTMLElement).closest("[data-holding-expanded-panel]"))
                                  return;
                                router.push(assetHref);
                              }
                            : undefined
                        }
                        onKeyDown={
                          assetHref
                            ? (e) => {
                                if (e.key !== "Enter" && e.key !== " ") return;
                                e.preventDefault();
                                router.push(assetHref);
                              }
                            : undefined
                        }
                        tabIndex={assetHref && !expanded ? 0 : undefined}
                        role={assetHref && !expanded ? "link" : undefined}
                        aria-label={assetHref && !expanded ? `Open ${companyName}` : undefined}
                      >
                        <div
                          className="relative z-[2] flex items-center justify-center"
                          onClick={(e) => e.stopPropagation()}
                          onKeyDown={(e) => e.stopPropagation()}
                        >
                          <PortfolioHoldingExpandButton
                            expanded={expanded}
                            onToggle={() => toggleExpandedHolding(h.id)}
                          />
                        </div>
                        <div
                          className={cn(
                            "relative z-[1] flex min-w-0 max-w-full items-center gap-3 pr-2",
                            TABLE_START_ALIGNED_PAD_CLASS,
                          )}
                        >
                          <CompanyLogo name={companyName} logoUrl={logo} symbol={h.symbol} />
                          <div className="min-w-0 text-left">
                            <div className={HOLDING_COMPANY_NAME_CLASS}>{companyName}</div>
                            <div className="text-[12px] font-normal leading-4 text-[#5C5D5F]">
                              {caption}
                            </div>
                          </div>
                        </div>
                        <div
                          className={cn(
                            "relative z-[1] min-w-0 w-full whitespace-nowrap text-right font-['Inter'] tabular-nums text-[#141414]",
                            TABLE_END_ALIGNED_PAD_CLASS,
                          )}
                        >
                          {formatPortfolioUsdPerUnit(h.marketPrice)}
                        </div>
                        <div
                          className={cn(
                            "relative z-[1] min-w-0 w-full whitespace-nowrap text-right",
                            TABLE_END_ALIGNED_PAD_CLASS,
                          )}
                        >
                          <div className="font-['Inter'] text-[14px] font-semibold leading-5 tabular-nums text-[#141414]">
                            {usd0.format(h.currentValue)}
                          </div>
                          <div className="text-[12px] font-normal leading-4 tabular-nums text-[#5C5D5F]">
                            {formatSharesWithUnit(h.shares, h.symbol)}
                          </div>
                        </div>
                        <div
                          className={cn(
                            "relative z-[1] min-w-0 w-full whitespace-nowrap text-right font-['Inter'] tabular-nums text-[#141414]",
                            TABLE_END_ALIGNED_PAD_CLASS,
                          )}
                        >
                          {formatPortfolioUsdPerUnit(h.avgPrice)}
                        </div>
                        <div
                          className={cn(
                            "relative z-[1] min-w-0 w-full whitespace-nowrap text-right",
                            TABLE_END_ALIGNED_PAD_CLASS,
                          )}
                        >
                          <PortfolioPnlBreakdownTooltip
                            totalUsd={totalUsd}
                            totalPct={totalPct}
                            unrealizedUsd={unrealizedUsd}
                            realizedUsd={realizedUsd}
                          />
                        </div>
                        <div
                          className={cn(
                            "relative z-[1] min-w-0 w-full whitespace-nowrap text-right font-['Inter'] tabular-nums text-[#141414]",
                            TABLE_END_ALIGNED_PAD_CLASS,
                          )}
                        >
                          {pct.format(weightPct)}%
                        </div>
                        {!selectedPortfolioReadOnly ? (
                          <div
                            className={cn("relative z-[2] flex justify-end", TABLE_END_ALIGNED_PAD_CLASS)}
                            data-holding-actions
                            onClick={(e) => e.stopPropagation()}
                          >
                            <HoldingRowActionsMenu
                              holding={h}
                              isOpen={openActionsHoldingId === h.id}
                              onOpenChange={(open) => setOpenActionsHoldingId(open ? h.id : null)}
                              onAddTransactions={(row) =>
                                openNewTransactionWithPreset(holdingToCompanyPick(row))
                              }
                              onRemoveAsset={setRemoveTarget}
                            />
                          </div>
                        ) : null}
                      </div>
                    </div>
                    {!expanded ? (
                      <div className={SCREENER_TABLE_STROKE_INSET_CLASS} aria-hidden />
                    ) : null}
                  </div>
                  {expanded ? (
                    <div className="min-w-0 max-w-full overflow-hidden border-y-2 border-solid border-[#EFEFEF] bg-white">
                      <PortfolioHoldingTransactionsPanel
                        holding={h}
                        transactions={transactions}
                        resolvedCompanyNames={resolvedCompanyNames}
                      />
                    </div>
                  ) : null}
                </Fragment>
              );
            })}

            <div className={SCREENER_TABLE_DATA_ROW_CLASS}>
              <div className={DEFAULT_TABLE_ROW_HOVER_PAD_CLASS}>
                <div
                  className={cn(
                    holdingsGridClass,
                    "min-h-[56px] cursor-pointer text-[14px] font-normal leading-5",
                    SCREENER_TABLE_ROW_HOVER_SURFACE_CLASS,
                  )}
                  onClick={() => router.push("/portfolio?tab=cash")}
                  onKeyDown={(e) => {
                    if (e.key !== "Enter" && e.key !== " ") return;
                    e.preventDefault();
                    router.push("/portfolio?tab=cash");
                  }}
                  tabIndex={0}
                  role="link"
                  aria-label="Open cash"
                >
                  <div aria-hidden />
                  <div
                    className={cn(
                      "relative z-[1] flex min-w-0 max-w-full items-center gap-3 pr-2",
                      TABLE_START_ALIGNED_PAD_CLASS,
                    )}
                  >
                    <CompanyLogo name="US Dollar" logoUrl="" symbol="USD" />
                    <div className="min-w-0 text-left">
                      <div className={HOLDING_COMPANY_NAME_CLASS}>US Dollar</div>
                      <div className="text-[12px] font-normal leading-4 text-[#5C5D5F]">USD</div>
                    </div>
                  </div>
                  <div
                    className={cn(
                      "relative z-[1] min-w-0 w-full whitespace-nowrap text-right font-['Inter'] tabular-nums text-[#141414]",
                      TABLE_END_ALIGNED_PAD_CLASS,
                    )}
                  >
                    {formatPortfolioUsdPerUnit(1)}
                  </div>
                  <div
                    className={cn(
                      "relative z-[1] min-w-0 w-full whitespace-nowrap text-right",
                      TABLE_END_ALIGNED_PAD_CLASS,
                    )}
                  >
                    <div className="font-['Inter'] text-[14px] font-semibold leading-5 tabular-nums text-[#141414]">
                      {usd0.format(cashUsd)}
                    </div>
                    <div className="text-[12px] font-normal leading-4 tabular-nums text-[#5C5D5F]">
                      {formatSharesDisplay(cashUsd)} USD
                    </div>
                  </div>
                  <div
                    className={cn(
                      "relative z-[1] min-w-0 w-full whitespace-nowrap text-right font-['Inter'] tabular-nums text-[#141414]",
                      TABLE_END_ALIGNED_PAD_CLASS,
                    )}
                  >
                    {formatPortfolioUsdPerUnit(1)}
                  </div>
                  <div
                    className={cn(
                      "relative z-[1] min-w-0 w-full whitespace-nowrap text-right",
                      TABLE_END_ALIGNED_PAD_CLASS,
                    )}
                  >
                    <div className="text-[14px] font-medium tabular-nums text-[#5C5D5F]">{EM_DASH}</div>
                    <div className="text-[12px] font-medium tabular-nums text-[#5C5D5F]">{EM_DASH}</div>
                  </div>
                  <div
                    className={cn(
                      "relative z-[1] min-w-0 w-full whitespace-nowrap text-right font-['Inter'] tabular-nums text-[#141414]",
                      TABLE_END_ALIGNED_PAD_CLASS,
                    )}
                  >
                    {pct.format(cashWeightPct)}%
                  </div>
                  {!selectedPortfolioReadOnly ? (
                    <div className={TABLE_END_ALIGNED_PAD_CLASS} aria-hidden />
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </ScreenerTableScroll>
      </div>
      </div>
    </>
  );
}

export const PortfolioHoldingsTable = memo(PortfolioHoldingsTableInner);
