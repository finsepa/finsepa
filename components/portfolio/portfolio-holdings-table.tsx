"use client";

import { memo, startTransition, useCallback, useState } from "react";
import Link from "next/link";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

import { CompanyLogo } from "@/components/screener/company-logo";
import { displayLogoUrlForPortfolioSymbol } from "@/lib/portfolio/portfolio-asset-display-logo";
import { usePortfolioOverviewAthReader } from "@/components/portfolio/portfolio-overview-ath-context";
import { RemoveAssetModal } from "@/components/portfolio/remove-asset-modal";
import { usePortfolioWorkspace } from "@/components/portfolio/portfolio-workspace-context";
import { portfolioHoldingAssetHref } from "@/lib/crypto/crypto-picker-universe";
import {
  portfolioAssetSymbolCaption,
  portfolioSharesUnitTicker,
} from "@/lib/portfolio/custom-asset-symbol";
import { netCashUsd, unrealizedProfitPct, unrealizedProfitUsd } from "@/lib/portfolio/overview-metrics";
import { cumulativeRealizedGainUsdForAsset } from "@/lib/portfolio/realized-pnl-from-trades";
import { cryptoRouteBase } from "@/lib/crypto/crypto-symbol-base";
import { isSupportedCryptoAssetSymbol } from "@/lib/crypto/crypto-logo-url";
import { formatPortfolioUsdPerUnit } from "@/lib/portfolio/format-portfolio-usd-unit";
import { cn } from "@/lib/utils";
import type { PortfolioHolding, PortfolioTransaction } from "@/components/portfolio/portfolio-types";

const EM_DASH = "\u2014";

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

function formatSignedUsd(n: number): string {
  const s = usd0.format(Math.abs(n));
  return n >= 0 ? `+${s}` : `-${s}`;
}

function formatSignedPct(n: number): string {
  const s = pct.format(Math.abs(n));
  return n >= 0 ? `+${s}%` : `-${s}%`;
}

function PortfolioHoldingsTableInner({
  holdings,
  transactions,
  className,
}: {
  holdings: PortfolioHolding[];
  transactions: PortfolioTransaction[];
  className?: string;
}) {
  const {
    selectedPortfolioId,
    transactionsByPortfolioId,
    setPortfolioHoldings,
    setPortfolioTransactions,
    editTransaction,
    closeEditTransaction,
    selectedPortfolioReadOnly,
  } = usePortfolioWorkspace();

  const [removeTarget, setRemoveTarget] = useState<PortfolioHolding | null>(null);

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
  const netWorth = equityValue + cashUsd;
  // Allocation display: if cash is negative, exclude it from the denominator so weights stay within 0–100%.
  const allocationDenomUsd = equityValue + Math.max(0, cashUsd);
  /** Same dollar as Total profit card (period All). */
  const portfolioReturnUsd = unrealizedProfitUsd(holdings);
  /** Same % as Total profit card ATH line (lifetime return on total cost basis), when overview has published it. */
  const athSnap = usePortfolioOverviewAthReader();
  const portfolioReturnPct =
    athSnap == null
      ? unrealizedProfitPct(holdings)
      : holdings.length === 0
        ? null
        : !athSnap.marketReady
          ? null
          : athSnap.athReturnPct;
  const cashWeightPct = allocationDenomUsd > 0 && cashUsd > 0 ? (cashUsd / allocationDenomUsd) * 100 : 0;

  const rows = holdings.map((h) => {
    const retUsd = h.currentValue - h.costBasis;
    const retPct = h.costBasis > 0 ? ((h.currentValue - h.costBasis) / h.costBasis) * 100 : 0;
    const weightRaw = allocationDenomUsd > 0 ? (h.currentValue / allocationDenomUsd) * 100 : 0;
    const weightPct = Math.min(100, Math.max(0, weightRaw));
    return { holding: h, retUsd, retPct, weightPct };
  });

  const sorted = [...rows].sort((a, b) => b.weightPct - a.weightPct);

  return (
    <>
      <RemoveAssetModal
        holding={removeTarget}
        onClose={() => setRemoveTarget(null)}
        onConfirmRemove={confirmRemoveAsset}
      />
      <div
        className={cn(
          "w-full overflow-x-auto border-t border-[#E4E4E7] pb-8",
          className,
        )}
      >
      <table className="w-full min-w-[920px] border-collapse">
        <thead>
          <tr className="min-h-[44px] border-b border-[#E4E4E7] bg-white text-[14px] font-medium leading-5 text-[#71717A]">
            <th className="whitespace-nowrap px-4 py-3 text-left">Asset</th>
            <th className="whitespace-nowrap px-4 py-3 text-right">Price</th>
            <th className="whitespace-nowrap px-4 py-3 text-right">Holdings</th>
            <th className="whitespace-nowrap px-4 py-3 text-right">Avg. Buy Price</th>
            <th className="whitespace-nowrap px-4 py-3 text-right">Profit/Loss</th>
            <th className="whitespace-nowrap px-4 py-3 text-right">Weight</th>
            <th
              className="w-12 px-4 py-3 text-right"
              aria-label={selectedPortfolioReadOnly ? undefined : "Actions"}
            />
          </tr>
        </thead>
        <tbody>
          {sorted.map(({ holding: h, retUsd, retPct, weightPct }) => {
            const cryptoKey = cryptoRouteBase(h.symbol);
            const assetKind: "stock" | "crypto" =
              isSupportedCryptoAssetSymbol(cryptoKey) ? "crypto" : "stock";
            const realizedUsd = cumulativeRealizedGainUsdForAsset(transactions, cryptoKey, assetKind);
            const unrealizedUsd = retUsd;
            const totalUsd = unrealizedUsd + realizedUsd;
            const assetHref = portfolioHoldingAssetHref(h.symbol);
            const logo = displayLogoUrlForPortfolioSymbol(h.symbol);
            const caption = portfolioAssetSymbolCaption(h.symbol);
            const assetInner = (
              <>
                <CompanyLogo name={h.name} logoUrl={logo} symbol={h.symbol} />
                <div className="min-w-0 text-left">
                  <div
                    className={cn(
                      "truncate text-[14px] font-semibold leading-5 text-[#09090B]",
                      assetHref && "group-hover:underline",
                    )}
                  >
                    {h.name}
                  </div>
                  <div className="text-[12px] font-normal leading-4 text-[#71717A]">{caption}</div>
                </div>
              </>
            );
            return (
            <tr
              key={h.id}
              className="h-[60px] max-h-[60px] border-b border-[#E4E4E7] transition-colors duration-75 hover:bg-neutral-50"
            >
              <td className="align-middle px-4 py-0">
                {assetHref ? (
                  <Link
                    href={assetHref}
                    className="group flex min-w-0 max-w-full items-center gap-3 rounded-lg py-2 pr-2 outline-none transition-colors hover:bg-neutral-50 focus-visible:ring-2 focus-visible:ring-[#09090B]/15 focus-visible:ring-offset-2"
                  >
                    {assetInner}
                  </Link>
                ) : (
                  <div className="flex min-w-0 max-w-full items-center gap-3 rounded-lg py-2 pr-2">{assetInner}</div>
                )}
              </td>
              <td className="align-middle whitespace-nowrap px-4 py-3 text-right font-['Inter'] text-[14px] leading-5 tabular-nums text-[#09090B]">
                {formatPortfolioUsdPerUnit(h.marketPrice)}
              </td>
              <td className="align-middle whitespace-nowrap px-4 py-3 text-right">
                <div className="font-['Inter'] text-[14px] font-semibold leading-5 tabular-nums text-[#09090B]">
                  {usd0.format(h.currentValue)}
                </div>
                <div className="text-[12px] font-normal leading-4 tabular-nums text-[#71717A]">
                  {formatSharesWithUnit(h.shares, h.symbol)}
                </div>
              </td>
              <td className="align-middle whitespace-nowrap px-4 py-3 text-right font-['Inter'] text-[14px] leading-5 tabular-nums text-[#09090B]">
                {formatPortfolioUsdPerUnit(h.avgPrice)}
              </td>
              <td className="align-middle whitespace-nowrap px-4 py-3 text-right">
                <div className="group/px relative inline-flex w-full flex-col items-end">
                  <div
                    className={cn(
                      "font-['Inter'] text-[14px] font-semibold leading-5 tabular-nums",
                      retUsd >= 0 ? "text-[#16A34A]" : "text-[#DC2626]",
                    )}
                  >
                    {formatSignedUsd(retUsd)}
                  </div>
                  <div
                    className={cn(
                      "text-[12px] font-medium leading-4 tabular-nums",
                      retPct >= 0 ? "text-[#16A34A]" : "text-[#DC2626]",
                    )}
                  >
                    {formatSignedPct(retPct)}
                  </div>

                  <div className="pointer-events-none absolute right-0 top-1/2 z-50 hidden w-[240px] -translate-y-1/2 translate-x-[calc(100%+12px)] rounded-[10px] border border-[#E4E4E7] bg-white px-3 py-2 text-left text-[12px] leading-4 text-[#09090B] shadow-[0px_8px_20px_0px_rgba(10,10,10,0.10)] group-hover/px:block">
                    <div className="font-semibold text-[#09090B]">Profit/Loss</div>
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
                </div>
              </td>
              <td className="align-middle whitespace-nowrap px-4 py-3 text-right font-['Inter'] text-[14px] leading-5 tabular-nums text-[#09090B]">
                {pct.format(weightPct)}%
              </td>
              <td className="align-middle px-4 py-3 text-right">
                {!selectedPortfolioReadOnly ? (
                  <button
                    type="button"
                    disabled={selectedPortfolioId == null}
                    aria-label={`Remove ${h.name} from portfolio`}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-[10px] text-[#71717A] transition-colors hover:bg-[#FEF2F2] hover:text-[#DC2626] disabled:pointer-events-none disabled:opacity-40"
                    onClick={() => setRemoveTarget(h)}
                  >
                    <Trash2 className="h-[18px] w-[18px]" strokeWidth={2} aria-hidden />
                  </button>
                ) : null}
              </td>
            </tr>
            );
          })}

          <tr className="h-[60px] max-h-[60px] border-b border-[#E4E4E7] bg-white transition-colors duration-75 hover:bg-neutral-50">
            <td className="align-middle px-4 py-0">
              <Link
                href="/portfolio?tab=cash"
                className="group flex min-w-0 max-w-full items-center gap-3 rounded-lg py-2 pr-2 outline-none transition-colors hover:bg-neutral-50 focus-visible:ring-2 focus-visible:ring-[#09090B]/15 focus-visible:ring-offset-2"
              >
                <CompanyLogo name="US Dollar" logoUrl="" symbol="USD" />
                <div className="min-w-0 text-left">
                  <div className="truncate text-[14px] font-semibold leading-5 text-[#09090B] group-hover:underline">
                    US Dollar
                  </div>
                  <div className="text-[12px] font-normal leading-4 text-[#71717A]">USD</div>
                </div>
              </Link>
            </td>
            <td className="align-middle whitespace-nowrap px-4 py-3 text-right font-['Inter'] text-[14px] leading-5 tabular-nums text-[#09090B]">
              {formatPortfolioUsdPerUnit(1)}
            </td>
            <td className="align-middle whitespace-nowrap px-4 py-3 text-right">
              <div className="font-['Inter'] text-[14px] font-semibold leading-5 tabular-nums text-[#09090B]">
                {usd0.format(cashUsd)}
              </div>
              <div className="text-[12px] font-normal leading-4 tabular-nums text-[#71717A]">
                {formatSharesDisplay(cashUsd)} USD
              </div>
            </td>
            <td className="align-middle whitespace-nowrap px-4 py-3 text-right font-['Inter'] text-[14px] leading-5 tabular-nums text-[#09090B]">
              {formatPortfolioUsdPerUnit(1)}
            </td>
            <td className="align-middle whitespace-nowrap px-4 py-3 text-right">
              <div className="text-[14px] font-medium tabular-nums text-[#71717A]">{EM_DASH}</div>
              <div className="text-[12px] font-medium tabular-nums text-[#71717A]">{EM_DASH}</div>
            </td>
            <td className="align-middle whitespace-nowrap px-4 py-3 text-right font-['Inter'] text-[14px] leading-5 tabular-nums text-[#09090B]">
              {pct.format(cashWeightPct)}%
            </td>
            <td className="align-middle px-4 py-3 text-right" aria-hidden />
          </tr>

          <tr className="h-[60px] max-h-[60px] border-b border-[#E4E4E7] bg-white transition-colors duration-75 hover:bg-neutral-50">
            <td className="align-middle px-4 py-0">
              <div className="flex min-w-0 max-w-full items-center gap-3 rounded-lg py-2 pr-2">
                <div className="min-w-0 text-left">
                  <div className="truncate text-[14px] font-semibold leading-5 text-[#09090B]">Total</div>
                  <div className="h-4 text-[12px] font-normal leading-4" aria-hidden />
                </div>
              </div>
            </td>
            <td className="align-middle whitespace-nowrap px-4 py-3 text-right font-['Inter'] text-[14px] leading-5 tabular-nums text-[#71717A]">
              {EM_DASH}
            </td>
            <td className="align-middle whitespace-nowrap px-4 py-3 text-right">
              <div className="font-['Inter'] text-[14px] font-semibold leading-5 tabular-nums text-[#09090B]">
                {usd0.format(netWorth)}
              </div>
              <div className="text-[12px] font-normal leading-4 tabular-nums text-[#71717A]">{EM_DASH}</div>
            </td>
            <td className="align-middle whitespace-nowrap px-4 py-3 text-right font-['Inter'] text-[14px] leading-5 tabular-nums text-[#71717A]">
              {EM_DASH}
            </td>
            <td className="align-middle whitespace-nowrap px-4 py-3 text-right">
              <div
                className={cn(
                  "font-['Inter'] text-[14px] font-semibold leading-5 tabular-nums",
                  portfolioReturnUsd >= 0 ? "text-[#16A34A]" : "text-[#DC2626]",
                )}
              >
                {formatSignedUsd(portfolioReturnUsd)}
              </div>
              <div
                className={cn(
                  "text-[12px] font-medium leading-4 tabular-nums",
                  portfolioReturnPct == null ? "text-[#71717A]"
                  : portfolioReturnPct >= 0 ? "text-[#16A34A]"
                  : "text-[#DC2626]",
                )}
              >
                {portfolioReturnPct != null ? formatSignedPct(portfolioReturnPct) : EM_DASH}
              </div>
            </td>
            <td className="align-middle whitespace-nowrap px-4 py-3 text-right font-['Inter'] text-[14px] leading-5 tabular-nums text-[#09090B]">
              100%
            </td>
            <td className="align-middle px-4 py-3 text-right" aria-hidden />
          </tr>
        </tbody>
      </table>
      </div>
    </>
  );
}

export const PortfolioHoldingsTable = memo(PortfolioHoldingsTableInner);
