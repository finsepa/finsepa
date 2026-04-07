"use client";

import { memo, useMemo } from "react";
import { ArrowUp, Settings } from "lucide-react";

import { CompanyLogo } from "@/components/screener/company-logo";
import { usePortfolioWorkspace } from "@/components/portfolio/portfolio-workspace-context";
import { cn } from "@/lib/utils";

const usd0 = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Net USD cash: sum of ledger `sum` (buys, sells, cash in/out, etc.). */
function netCashUsd(transactions: { sum: number }[]): number {
  return transactions.reduce((acc, t) => acc + t.sum, 0);
}

function balanceClassName(n: number): string {
  if (n < 0) return "text-[#DC2626]";
  if (n > 0) return "text-[#16A34A]";
  return "text-[#09090B]";
}

/**
 * Cash balance from ledger activity (can be negative). Styled like portfolio / screener tables.
 */
function PortfolioCashPanelInner() {
  const { selectedPortfolioId, transactionsByPortfolioId } = usePortfolioWorkspace();

  const transactions = useMemo(
    () => (selectedPortfolioId != null ? transactionsByPortfolioId[selectedPortfolioId] ?? [] : []),
    [transactionsByPortfolioId, selectedPortfolioId],
  );

  const cashUsd = useMemo(() => netCashUsd(transactions), [transactions]);

  return (
    <div>
      <h2 className="mb-4 text-lg font-semibold leading-7 text-[#09090B]">Cash</h2>

      <div className="w-full overflow-x-auto pb-8">
        <table className="w-full min-w-[480px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-[#E4E4E7] text-[#71717A]">
              <th className="pb-3 pr-4 text-left text-[14px] font-medium leading-5">
                <span className="inline-flex items-center gap-1">
                  Currency
                  <Settings className="h-3.5 w-3.5 opacity-60" aria-hidden />
                </span>
              </th>
              <th className="whitespace-nowrap pb-3 pl-4 text-right text-[14px] font-medium leading-5">
                <span className="inline-flex w-full items-center justify-end gap-1">
                  Balance
                  <ArrowUp className="h-3.5 w-3.5 shrink-0 opacity-60" aria-hidden />
                </span>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-[#E4E4E7]">
              <td className="py-3 pr-4 align-middle">
                <div className="flex min-w-0 items-center gap-3">
                  <CompanyLogo name="US Dollar" logoUrl="" symbol="USD" />
                  <div className="min-w-0">
                    <div className="truncate text-[14px] font-semibold leading-5 text-[#09090B]">
                      US Dollar
                    </div>
                    <div className="text-[12px] font-normal leading-4 text-[#71717A]">USD</div>
                  </div>
                </div>
              </td>
              <td
                className={cn(
                  "whitespace-nowrap py-3 pl-4 text-right align-middle text-[14px] leading-5 font-normal tabular-nums",
                  balanceClassName(cashUsd),
                )}
              >
                {usd0.format(cashUsd)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

export const PortfolioCashPanel = memo(PortfolioCashPanelInner);
