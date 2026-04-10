"use client";

import { Fragment, memo, useCallback, useEffect, useMemo, useState } from "react";
import { ArrowDownUp, ListX } from "lucide-react";
import { format, parseISO } from "date-fns";

import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { DeleteTransactionConfirmModal } from "@/components/portfolio/delete-transaction-confirm-modal";
import { TransactionRowActionsMenu } from "@/components/portfolio/transaction-row-actions-menu";
import { CompanyLogo } from "@/components/screener/company-logo";
import { displayLogoUrlForPortfolioSymbol } from "@/lib/portfolio/portfolio-asset-display-logo";
import { portfolioAssetSymbolCaption } from "@/lib/portfolio/custom-asset-symbol";
import { formatPortfolioUsdPerUnit } from "@/lib/portfolio/format-portfolio-usd-unit";
import { usePortfolioWorkspace } from "@/components/portfolio/portfolio-workspace-context";
import { TABLE_PAGE_SIZE, TablePaginationBar, tablePageCount } from "@/components/ui/table-pagination";
import { cn } from "@/lib/utils";
import type { PortfolioTransaction, PortfolioTransactionKind } from "@/components/portfolio/portfolio-types";

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
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

const FILTERS = ["All", "Trades", "Income", "Cash"] as const;
type TxFilter = (typeof FILTERS)[number];

function filterMatches(kind: PortfolioTransactionKind, f: TxFilter): boolean {
  if (f === "All") return true;
  if (f === "Trades") return kind === "trade";
  if (f === "Income") return kind === "income";
  if (f === "Cash") return kind === "cash";
  return true;
}

function formatSignedUsd(n: number): string {
  const s = usd0.format(Math.abs(n));
  return n >= 0 ? `+${s}` : `-${s}`;
}

function formatSignedPct(n: number): string {
  const s = pct.format(Math.abs(n));
  return n >= 0 ? `+${s}%` : `-${s}%`;
}

function sumColor(sum: number): string {
  if (sum > 0) return "text-emerald-600";
  if (sum < 0) return "text-red-600";
  return "text-[#09090B]";
}

function opColor(operation: string): string {
  const u = operation.toLowerCase();
  if (u.includes("sell")) return "text-red-600";
  if (u.includes("buy") || u.includes("cash in")) return "text-emerald-600";
  if (u.includes("cash out")) return "text-red-600";
  return "text-[#09090B]";
}

function groupTransactionsByMonth(sortedDesc: PortfolioTransaction[]) {
  const map = new Map<string, PortfolioTransaction[]>();
  for (const t of sortedDesc) {
    const key = format(parseISO(t.date), "yyyy-MM");
    const list = map.get(key) ?? [];
    list.push(t);
    map.set(key, list);
  }
  const keys = [...map.keys()].sort((a, b) => b.localeCompare(a));
  return keys.map((k) => ({
    key: k,
    label: format(parseISO(`${k}-01`), "MMMM, yyyy"),
    rows: map.get(k) ?? [],
  }));
}

function PortfolioTransactionsTableInner({ transactions }: { transactions: PortfolioTransaction[] }) {
  const { openEditTransaction, removePortfolioTransaction, selectedPortfolioReadOnly } =
    usePortfolioWorkspace();
  const [filter, setFilter] = useState<TxFilter>("All");
  const [page, setPage] = useState(1);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [deleteCandidate, setDeleteCandidate] = useState<PortfolioTransaction | null>(null);

  const handleConfirmDelete = useCallback(async () => {
    if (!deleteCandidate) return;
    await removePortfolioTransaction(deleteCandidate);
  }, [deleteCandidate, removePortfolioTransaction]);

  const filtered = useMemo(
    () => transactions.filter((t) => filterMatches(t.kind, filter)),
    [transactions, filter],
  );

  useEffect(() => {
    setPage(1);
  }, [filter]);

  const flatSorted = useMemo(
    () => [...filtered].sort((a, b) => parseISO(b.date).getTime() - parseISO(a.date).getTime()),
    [filtered],
  );

  const txPageCount = useMemo(() => tablePageCount(flatSorted.length), [flatSorted.length]);

  useEffect(() => {
    setPage((p) => Math.min(p, txPageCount));
  }, [txPageCount]);

  const safeTxPage = Math.min(Math.max(1, page), txPageCount);
  const pageSlice = useMemo(
    () => flatSorted.slice((safeTxPage - 1) * TABLE_PAGE_SIZE, safeTxPage * TABLE_PAGE_SIZE),
    [flatSorted, safeTxPage],
  );

  const grouped = useMemo(() => groupTransactionsByMonth(pageSlice), [pageSlice]);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-lg font-semibold leading-7 text-[#09090B]">Transactions</h2>
        <div className="flex flex-wrap items-center gap-2">
          <div
            className="inline-flex shrink-0 rounded-full bg-[#F4F4F5] p-0.5"
            role="group"
            aria-label="Transaction type"
          >
            {FILTERS.map((f) => {
              const active = f === filter;
              return (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFilter(f)}
                  className={cn(
                    "rounded-[10px] px-3 py-1.5 text-sm font-medium leading-5 transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#09090B]/15 focus-visible:ring-offset-2 sm:px-4",
                    active
                      ? "bg-white text-[#09090B] shadow-[0px_1px_4px_0px_rgba(10,10,10,0.12),0px_1px_2px_0px_rgba(10,10,10,0.07)]"
                      : "text-[#71717A] hover:text-[#09090B]",
                  )}
                >
                  {f}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {transactions.length === 0 ? (
        <Empty variant="card">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <ListX className="h-6 w-6" strokeWidth={1.75} aria-hidden />
            </EmptyMedia>
            <EmptyTitle>No transactions</EmptyTitle>
            <EmptyDescription>
              Add a trade, cash movement, or use Import Transactions above to see it here.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : filtered.length === 0 ? (
        <p className="py-8 text-center text-sm text-[#71717A]">No transactions in this category.</p>
      ) : (
        <div className="w-full">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1000px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-[#E4E4E7] text-left text-[#71717A]">
                <th className="pb-3 pr-4 font-medium">Asset</th>
                <th className="whitespace-nowrap pb-3 pr-4 font-medium">Operation</th>
                <th className="whitespace-nowrap pb-3 pr-4 font-medium">
                  <span className="inline-flex items-center gap-1">
                    Date
                    <ArrowDownUp className="h-3.5 w-3.5 opacity-60" aria-hidden />
                  </span>
                </th>
                <th className="whitespace-nowrap pb-3 pr-4 font-medium">Shares</th>
                <th className="whitespace-nowrap pb-3 pr-4 font-medium">Price</th>
                <th className="whitespace-nowrap pb-3 pr-4 font-medium">Fee</th>
                <th className="whitespace-nowrap pb-3 pr-4 font-medium">Summ</th>
                <th className="whitespace-nowrap pb-3 pr-4 font-medium">Total profit</th>
                <th
                  className="w-12 pb-3 pr-0 font-medium"
                  aria-label={selectedPortfolioReadOnly ? undefined : "Actions"}
                />
              </tr>
            </thead>
            <tbody>
              {grouped.map((g) => (
                <Fragment key={g.key}>
                  <tr className="bg-[#FAFAFA]">
                    <td
                      colSpan={9}
                      className="py-2 pl-1 pr-4 text-[13px] font-semibold text-[#71717A]"
                    >
                      {g.label}
                    </td>
                  </tr>
                  {g.rows.map((t) => (
                    <tr key={t.id} className="border-b border-[#E4E4E7]">
                      <td className="py-3 pr-4">
                        <div className="flex items-center gap-3">
                          <CompanyLogo name={t.name} logoUrl={displayLogoUrlForPortfolioSymbol(t.symbol)} symbol={t.symbol} />
                          <div className="min-w-0">
                            <div className="font-semibold text-[#09090B]">{t.name}</div>
                            <div className="text-xs text-[#71717A]">{portfolioAssetSymbolCaption(t.symbol)}</div>
                          </div>
                        </div>
                      </td>
                      <td className={cn("whitespace-nowrap py-3 pr-4 font-medium", opColor(t.operation))}>
                        {t.operation}
                      </td>
                      <td className="whitespace-nowrap py-3 pr-4 tabular-nums text-[#09090B]">
                        {format(parseISO(t.date), "MMM d, yyyy")}
                      </td>
                      <td className="whitespace-nowrap py-3 pr-4 tabular-nums text-[#09090B]">
                        {new Intl.NumberFormat("en-US", { maximumFractionDigits: 6 }).format(t.shares)}
                      </td>
                      <td className="whitespace-nowrap py-3 pr-4 tabular-nums text-[#09090B]">
                        {formatPortfolioUsdPerUnit(t.price)}
                      </td>
                      <td className="whitespace-nowrap py-3 pr-4 tabular-nums text-[#09090B]">
                        {t.fee > 0 ? usd.format(t.fee) : "—"}
                      </td>
                      <td className={cn("whitespace-nowrap py-3 pr-4 font-medium tabular-nums", sumColor(t.sum))}>
                        {formatSignedUsd(t.sum)}
                      </td>
                      <td className="whitespace-nowrap py-3 pr-4">
                        {t.profitPct != null && t.profitUsd != null ? (
                          <div>
                            <div
                              className={cn(
                                "font-medium tabular-nums",
                                t.profitUsd >= 0 ? "text-emerald-600" : "text-red-600",
                              )}
                            >
                              {formatSignedPct(t.profitPct)} ({formatSignedUsd(t.profitUsd)})
                            </div>
                          </div>
                        ) : (
                          <span className="text-[#A1A1AA]">—</span>
                        )}
                      </td>
                      <td className="py-3 pr-0 text-right">
                        {!selectedPortfolioReadOnly ? (
                          <div className="inline-flex justify-end">
                            <TransactionRowActionsMenu
                              transaction={t}
                              isOpen={openMenuId === t.id}
                              onOpenChange={(open) => setOpenMenuId(open ? t.id : null)}
                              onEdit={openEditTransaction}
                              onRequestDelete={setDeleteCandidate}
                            />
                          </div>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
          </div>
          <TablePaginationBar page={safeTxPage} totalItems={flatSorted.length} onPageChange={setPage} />
        </div>
      )}

      <DeleteTransactionConfirmModal
        transaction={deleteCandidate}
        onClose={() => setDeleteCandidate(null)}
        onConfirmDelete={handleConfirmDelete}
      />
    </div>
  );
}

export const PortfolioTransactionsTable = memo(PortfolioTransactionsTableInner);
