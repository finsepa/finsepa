"use client";

import { ArrowDown, ArrowUp, ChevronDown, ChevronUp } from "@/lib/icons";
import { Fragment, memo, startTransition, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import type { CompanyPick } from "@/components/charting/company-picker";
import { CompanyLogo } from "@/components/screener/company-logo";
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
  "truncate text-[14px] font-semibold leading-5 text-[#0F0F0F] underline-offset-2 decoration-[#71717A] group-hover:underline";

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
        "inline-flex h-7 w-7 items-center justify-center rounded-full border border-transparent bg-transparent text-[#0F0F0F]",
        "transition-colors hover:bg-[#F4F4F5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0F0F0F]/15",
        expanded && "bg-[#F4F4F5]",
      )}
    >
      {expanded ?
        <ChevronUp className="h-4 w-4" strokeWidth={2} aria-hidden />
      : <ChevronDown className="h-4 w-4" strokeWidth={2} aria-hidden />}
    </button>
  );
}

function holdingRowTdBorder(expanded: boolean) {
  return expanded ? undefined : "border-b border-[#E4E4E7]";
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
        className="pointer-events-none fixed z-[200] w-[240px] rounded-[10px] border border-[#E4E4E7] bg-white px-3 py-2 text-left text-[12px] leading-4 text-[#0F0F0F] shadow-[0px_8px_20px_0px_rgba(10,10,10,0.10)]"
        style={{ left: pos.left, top: pos.top }}
        role="tooltip"
      >
        <div className="font-semibold text-[#0F0F0F]">Profit/Loss</div>
        <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1">
          <div className="text-[#71717A]">Unrealized</div>
          <div className={cn("text-right tabular-nums", unrealizedUsd >= 0 ? "text-[#16A34A]" : "text-[#DC2626]")}>
            {formatSignedUsd(unrealizedUsd)}
          </div>
          <div className="text-[#71717A]">Realized</div>
          <div className={cn("text-right tabular-nums", realizedUsd >= 0 ? "text-[#16A34A]" : "text-[#DC2626]")}>
            {formatSignedUsd(realizedUsd)}
          </div>
          <div className="text-[#71717A]">Total</div>
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
    <th className="whitespace-nowrap border-b border-[#E4E4E7] px-4 py-[10px] text-right text-[14px] font-medium leading-5 text-[#71717A]">
      <button
        type="button"
        className="inline-flex w-full items-center justify-end gap-1 rounded text-[14px] font-medium leading-5 text-[#71717A] hover:text-[#0F0F0F]"
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
    </th>
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

  const tableColSpan = selectedPortfolioReadOnly ? 7 : 8;

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
      <div
        className={cn(
          "w-full overflow-x-visible max-md:pb-4 sm:overflow-x-auto sm:border-t sm:border-[#E4E4E7] sm:pb-8",
          className,
        )}
      >
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
                  <div className="truncate text-[12px] font-normal leading-4 text-[#71717A]">
                    {caption} · {formatSharesAsShares(h.shares)}
                  </div>
                </div>
              </div>
            );

            const right = (
              <div className="min-w-0 text-right">
                <div className="font-['Inter'] text-[14px] font-semibold leading-5 tabular-nums text-[#0F0F0F]">
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
                    className="absolute inset-0 z-0 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-[#0F0F0F]/15 focus-visible:ring-offset-2"
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
                <div className="truncate text-[14px] font-semibold leading-5 text-[#0F0F0F]">US Dollar</div>
                <div className="truncate text-[12px] font-normal leading-4 text-[#71717A]">
                  USD · {formatSharesDisplay(cashUsd)} USD
                </div>
              </div>
            </div>
            <div className="min-w-0 text-right">
              <div className="font-['Inter'] text-[14px] font-semibold leading-5 tabular-nums text-[#0F0F0F]">
                {usd0.format(cashUsd)}
              </div>
              <div className="mt-0.5 truncate text-[12px] font-medium leading-4 tabular-nums text-[#71717A]">
                {EM_DASH}
              </div>
            </div>
          </div>
        </div>
      </div>

      <table className="hidden w-full min-w-[960px] border-separate border-spacing-0 sm:table">
        <thead>
          <tr className="min-h-[40px] bg-white text-[14px] font-medium leading-5 text-[#71717A]">
            <th className="w-11 border-b border-[#E4E4E7] px-2 py-[10px] font-medium" aria-hidden />
            <th className="whitespace-nowrap border-b border-[#E4E4E7] px-4 py-[10px] text-left text-[14px] font-medium leading-5 text-[#71717A]">
              Asset
            </th>
            <th className="whitespace-nowrap border-b border-[#E4E4E7] px-4 py-[10px] text-right text-[14px] font-medium leading-5 text-[#71717A]">
              Price
            </th>
            <HoldingsSortHeader
              label="Holdings"
              sortKey="holdings"
              activeKey={sort.key}
              dir={sort.dir}
              onSort={onSort}
            />
            <th className="whitespace-nowrap border-b border-[#E4E4E7] px-4 py-[10px] text-right text-[14px] font-medium leading-5 text-[#71717A]">
              Avg. Buy Price
            </th>
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
              <th className="w-12 border-b border-[#E4E4E7] px-4 py-[10px] text-right" aria-label="Actions" />
            ) : null}
          </tr>
        </thead>
        <tbody>
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
            const assetInner = (
              <>
                <CompanyLogo name={companyName} logoUrl={logo} symbol={h.symbol} />
                <div className="min-w-0 text-left">
                  <div className={HOLDING_COMPANY_NAME_CLASS}>{companyName}</div>
                  <div className="text-[12px] font-normal leading-4 text-[#71717A]">{caption}</div>
                </div>
              </>
            );
            return (
            <Fragment key={h.id}>
            <tr
              className={cn(
                "group relative h-[56px] max-h-[56px] transition-colors duration-75 hover:bg-neutral-50",
                assetHref && !expanded && "cursor-pointer",
              )}
              onClick={
                assetHref
                  ? (e) => {
                      if ((e.target as HTMLElement).closest("[data-holding-actions]")) return;
                      if ((e.target as HTMLElement).closest("[data-holding-expand]")) return;
                      if ((e.target as HTMLElement).closest("[data-holding-expanded-panel]")) return;
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
              <td
                className={cn(
                  "relative z-[2] w-11 px-2 py-0 align-middle",
                  holdingRowTdBorder(expanded),
                )}
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-center py-2">
                  <PortfolioHoldingExpandButton
                    expanded={expanded}
                    onToggle={() => toggleExpandedHolding(h.id)}
                  />
                </div>
              </td>
              <td className={cn("relative z-[1] align-middle px-4 py-0", holdingRowTdBorder(expanded))}>
                <div className="flex min-w-0 max-w-full items-center gap-3 py-2 pr-2">{assetInner}</div>
              </td>
              <td
                className={cn(
                  "relative z-[1] align-middle whitespace-nowrap px-4 py-[10px] text-right font-['Inter'] text-[14px] leading-5 tabular-nums text-[#0F0F0F]",
                  holdingRowTdBorder(expanded),
                )}
              >
                {formatPortfolioUsdPerUnit(h.marketPrice)}
              </td>
              <td
                className={cn(
                  "relative z-[1] align-middle whitespace-nowrap px-4 py-[10px] text-right",
                  holdingRowTdBorder(expanded),
                )}
              >
                <div className="font-['Inter'] text-[14px] font-semibold leading-5 tabular-nums text-[#0F0F0F]">
                  {usd0.format(h.currentValue)}
                </div>
                <div className="text-[12px] font-normal leading-4 tabular-nums text-[#71717A]">
                  {formatSharesWithUnit(h.shares, h.symbol)}
                </div>
              </td>
              <td
                className={cn(
                  "relative z-[1] align-middle whitespace-nowrap px-4 py-[10px] text-right font-['Inter'] text-[14px] leading-5 tabular-nums text-[#0F0F0F]",
                  holdingRowTdBorder(expanded),
                )}
              >
                {formatPortfolioUsdPerUnit(h.avgPrice)}
              </td>
              <td
                className={cn(
                  "relative z-[1] align-middle whitespace-nowrap px-4 py-[10px] text-right",
                  holdingRowTdBorder(expanded),
                )}
              >
                <PortfolioPnlBreakdownTooltip
                  totalUsd={totalUsd}
                  totalPct={totalPct}
                  unrealizedUsd={unrealizedUsd}
                  realizedUsd={realizedUsd}
                />
              </td>
              <td
                className={cn(
                  "relative z-[1] align-middle whitespace-nowrap px-4 py-[10px] text-right font-['Inter'] text-[14px] leading-5 tabular-nums text-[#0F0F0F]",
                  holdingRowTdBorder(expanded),
                )}
              >
                {pct.format(weightPct)}%
              </td>
              {!selectedPortfolioReadOnly ? (
                <td
                  className={cn(
                    "relative z-[2] align-middle px-4 py-[10px] text-right",
                    holdingRowTdBorder(expanded),
                  )}
                  data-holding-actions
                >
                  <div className="relative flex justify-end">
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
                </td>
              ) : null}
            </tr>
            {expanded ? (
              <tr className="bg-white">
                <td colSpan={tableColSpan} className="border-t-2 border-b-2 border-[#E4E4E7] p-0">
                  <PortfolioHoldingTransactionsPanel
                    holding={h}
                    transactions={transactions}
                    resolvedCompanyNames={resolvedCompanyNames}
                  />
                </td>
              </tr>
            ) : null}
            </Fragment>
            );
          })}

          <tr
            className="group relative h-[60px] max-h-[60px] cursor-pointer bg-white transition-colors duration-75 hover:bg-neutral-50"
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
            <td className="relative z-[2] w-11 border-b border-[#E4E4E7] px-2 py-0 align-middle" aria-hidden />
            <td className="relative z-[1] border-b border-[#E4E4E7] align-middle px-4 py-0">
              <div className="flex min-w-0 max-w-full items-center gap-3 py-2 pr-2">
                <CompanyLogo name="US Dollar" logoUrl="" symbol="USD" />
                <div className="min-w-0 text-left">
                  <div className={HOLDING_COMPANY_NAME_CLASS}>US Dollar</div>
                  <div className="text-[12px] font-normal leading-4 text-[#71717A]">USD</div>
                </div>
              </div>
            </td>
            <td className="relative z-[1] border-b border-[#E4E4E7] align-middle whitespace-nowrap px-4 py-[10px] text-right font-['Inter'] text-[14px] leading-5 tabular-nums text-[#0F0F0F]">
              {formatPortfolioUsdPerUnit(1)}
            </td>
            <td className="relative z-[1] border-b border-[#E4E4E7] align-middle whitespace-nowrap px-4 py-[10px] text-right">
              <div className="font-['Inter'] text-[14px] font-semibold leading-5 tabular-nums text-[#0F0F0F]">
                {usd0.format(cashUsd)}
              </div>
              <div className="text-[12px] font-normal leading-4 tabular-nums text-[#71717A]">
                {formatSharesDisplay(cashUsd)} USD
              </div>
            </td>
            <td className="relative z-[1] border-b border-[#E4E4E7] align-middle whitespace-nowrap px-4 py-[10px] text-right font-['Inter'] text-[14px] leading-5 tabular-nums text-[#0F0F0F]">
              {formatPortfolioUsdPerUnit(1)}
            </td>
            <td className="relative z-[1] border-b border-[#E4E4E7] align-middle whitespace-nowrap px-4 py-[10px] text-right">
              <div className="text-[14px] font-medium tabular-nums text-[#71717A]">{EM_DASH}</div>
              <div className="text-[12px] font-medium tabular-nums text-[#71717A]">{EM_DASH}</div>
            </td>
            <td className="relative z-[1] border-b border-[#E4E4E7] align-middle whitespace-nowrap px-4 py-[10px] text-right font-['Inter'] text-[14px] leading-5 tabular-nums text-[#0F0F0F]">
              {pct.format(cashWeightPct)}%
            </td>
            <td className="relative z-[1] border-b border-[#E4E4E7] align-middle px-4 py-[10px] text-right" aria-hidden />
          </tr>
        </tbody>
      </table>
      </div>
    </>
  );
}

export const PortfolioHoldingsTable = memo(PortfolioHoldingsTableInner);
