"use client";

import { Fragment, memo, useCallback, useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ListX, Search } from "lucide-react";
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
import { toastTransactionDeleted } from "@/lib/portfolio/transaction-deleted-toast";
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

/** Matches Screener / Cash tab grid tables — see `screener-table.tsx`, `portfolio-cash-panel.tsx`. */
const txGrid =
  "grid grid-cols-[minmax(200px,2.4fr)_minmax(88px,1fr)_minmax(108px,1.1fr)_minmax(80px,1fr)_minmax(96px,1.1fr)_minmax(64px,0.85fr)_minmax(96px,1.1fr)_minmax(128px,1.35fr)_40px] items-center gap-x-2";

const FILTERS = ["All", "Trades", "Income", "Expenses", "Cash"] as const;
type TxFilter = (typeof FILTERS)[number];

function filterMatches(kind: PortfolioTransactionKind, f: TxFilter): boolean {
  if (f === "All") return true;
  if (f === "Trades") return kind === "trade";
  if (f === "Income") return kind === "income";
  if (f === "Expenses") return kind === "expense";
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

function sumColorClass(sum: number): string {
  if (sum > 0) return "text-[#16A34A]";
  if (sum < 0) return "text-[#DC2626]";
  return "text-[#09090B]";
}

function opColorClass(operation: string): string {
  const u = operation.toLowerCase();
  if (u.includes("sell") || u.includes("cash out")) return "text-[#DC2626]";
  if (u.includes("expense") || u.includes("fees") || u.includes("brokerage fee")) return "text-[#DC2626]";
  if (u.includes("buy") || u.includes("cash in") || u.includes("other income")) return "text-[#16A34A]";
  return "text-[#09090B]";
}

function transactionMatchesAssetSearch(t: PortfolioTransaction, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  if (t.name.toLowerCase().includes(q)) return true;
  if (t.symbol.toLowerCase().includes(q)) return true;
  if (portfolioAssetSymbolCaption(t.symbol).toLowerCase().includes(q)) return true;
  const note = t.note?.trim();
  if (note && note.toLowerCase().includes(q)) return true;
  return false;
}

function groupTransactionsByMonth(sorted: PortfolioTransaction[], newestMonthFirst: boolean) {
  const map = new Map<string, PortfolioTransaction[]>();
  for (const t of sorted) {
    const key = format(parseISO(t.date), "yyyy-MM");
    const list = map.get(key) ?? [];
    list.push(t);
    map.set(key, list);
  }
  const keys = [...map.keys()].sort((a, b) => (newestMonthFirst ? b.localeCompare(a) : a.localeCompare(b)));
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
  const [txSearch, setTxSearch] = useState("");
  const [page, setPage] = useState(1);
  const [dateDesc, setDateDesc] = useState(true);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [deleteCandidate, setDeleteCandidate] = useState<PortfolioTransaction | null>(null);

  const handleConfirmDelete = useCallback(async () => {
    if (!deleteCandidate) return;
    const snapshot = deleteCandidate;
    await removePortfolioTransaction(snapshot);
    toastTransactionDeleted(snapshot);
  }, [deleteCandidate, removePortfolioTransaction]);

  const filtered = useMemo(() => {
    const byKind = transactions.filter((t) => filterMatches(t.kind, filter));
    return byKind.filter((t) => transactionMatchesAssetSearch(t, txSearch));
  }, [transactions, filter, txSearch]);

  const flatSorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      const ta = parseISO(a.date).getTime();
      const tb = parseISO(b.date).getTime();
      return dateDesc ? tb - ta : ta - tb;
    });
    return arr;
  }, [filtered, dateDesc]);

  useEffect(() => {
    setPage(1);
  }, [filter, dateDesc, txSearch]);

  const txPageCount = useMemo(() => tablePageCount(flatSorted.length), [flatSorted.length]);

  useEffect(() => {
    setPage((p) => Math.min(p, txPageCount));
  }, [txPageCount]);

  const safeTxPage = Math.min(Math.max(1, page), txPageCount);
  const pageSlice = useMemo(
    () => flatSorted.slice((safeTxPage - 1) * TABLE_PAGE_SIZE, safeTxPage * TABLE_PAGE_SIZE),
    [flatSorted, safeTxPage],
  );

  const grouped = useMemo(
    () => groupTransactionsByMonth(pageSlice, dateDesc),
    [pageSlice, dateDesc],
  );

  return (
    <div>
      <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <h2 className="text-lg font-semibold leading-7 text-[#09090B]">Transactions</h2>
        <div className="flex w-full min-w-0 flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
          <div className="relative min-w-[200px] max-w-full flex-1 sm:w-[260px] sm:flex-none">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#71717A]"
              aria-hidden
            />
            <input
              type="search"
              value={txSearch}
              onChange={(e) => setTxSearch(e.target.value)}
              placeholder="Type to search..."
              className="h-9 w-full rounded-[10px] border-0 bg-[#F4F4F5] py-2 pl-9 pr-3 text-sm text-[#09090B] placeholder:text-[#71717A] outline-none focus:ring-2 focus:ring-[#09090B]/10"
              aria-label="Search transactions by asset name or ticker"
            />
          </div>
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
        <p className="py-8 text-center text-sm text-[#71717A]">
          {txSearch.trim() ? "No transactions match your search." : "No transactions in this category."}
        </p>
      ) : (
        <div className="w-full min-w-0">
          <div className="overflow-x-auto pb-4">
            <div className="min-w-[960px] divide-y divide-[#E4E4E7] border-t border-[#E4E4E7]">
              <div
                className={cn(
                  txGrid,
                  "min-h-[44px] bg-white px-4 py-0 text-[14px] font-medium leading-5 text-[#71717A] [&>div]:text-center",
                )}
              >
                <div className="!text-left">Asset</div>
                <div>Operation</div>
                <div>
                  <button
                    type="button"
                    onClick={() => setDateDesc((v) => !v)}
                    className="inline-flex items-center justify-center gap-1 rounded-md transition-colors hover:text-[#09090B] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#09090B]/15"
                    aria-label={dateDesc ? "Sort date oldest first" : "Sort date newest first"}
                  >
                    Date
                    {dateDesc ? (
                      <ArrowDown className="h-3.5 w-3.5 opacity-70" aria-hidden />
                    ) : (
                      <ArrowUp className="h-3.5 w-3.5 opacity-70" aria-hidden />
                    )}
                  </button>
                </div>
                <div>Shares</div>
                <div>Price</div>
                <div>Fee</div>
                <div>Summ</div>
                <div>Total profit</div>
                <div className="!text-right">
                  <span className="sr-only">Actions</span>
                </div>
              </div>

              {grouped.map((g) => (
                <Fragment key={g.key}>
                  <div className="bg-[#FAFAFA] px-4 py-2">
                    <span className="text-[14px] font-semibold leading-5 text-[#71717A]">{g.label}</span>
                  </div>
                  {g.rows.map((t) => (
                    <div
                      key={t.id}
                      className={cn(
                        txGrid,
                        "h-[60px] max-h-[60px] bg-white px-1 transition-colors duration-75 hover:bg-neutral-50 [&>div]:text-center",
                      )}
                    >
                      <div className="min-w-0 !text-left">
                        <div className="flex min-w-0 items-center gap-3 pr-2">
                          <CompanyLogo
                            name={t.name}
                            logoUrl={displayLogoUrlForPortfolioSymbol(t.symbol)}
                            symbol={t.symbol}
                          />
                          <div className="min-w-0">
                            <div className="truncate text-[14px] font-semibold leading-5 text-[#09090B]">
                              {t.name}
                            </div>
                            <div className="text-[12px] font-normal leading-4 text-[#71717A]">
                              {portfolioAssetSymbolCaption(t.symbol)}
                            </div>
                          </div>
                        </div>
                      </div>
                      <div
                        className={cn(
                          "min-w-0 truncate px-1 text-[14px] font-medium leading-5",
                          opColorClass(t.operation),
                        )}
                      >
                        {t.operation}
                      </div>
                      <div className="font-['Inter'] text-[14px] leading-5 font-normal tabular-nums text-[#09090B]">
                        {format(parseISO(t.date), "MMM d, yyyy")}
                      </div>
                      <div className="font-['Inter'] text-[14px] leading-5 font-normal tabular-nums text-[#09090B]">
                        {new Intl.NumberFormat("en-US", { maximumFractionDigits: 6 }).format(t.shares)}
                      </div>
                      <div className="font-['Inter'] text-[14px] leading-5 font-normal tabular-nums text-[#09090B]">
                        {formatPortfolioUsdPerUnit(t.price)}
                      </div>
                      <div className="font-['Inter'] text-[14px] leading-5 font-normal tabular-nums text-[#09090B]">
                        {t.fee > 0 ? usd.format(t.fee) : "—"}
                      </div>
                      <div
                        className={cn(
                          "text-[14px] font-medium leading-5 tabular-nums",
                          sumColorClass(t.sum),
                        )}
                      >
                        {formatSignedUsd(t.sum)}
                      </div>
                      <div className="min-w-0 text-[14px] font-medium leading-5">
                        {t.profitPct != null && t.profitUsd != null ? (
                          <span
                            className={cn(
                              "tabular-nums",
                              t.profitUsd >= 0 ? "text-[#16A34A]" : "text-[#DC2626]",
                            )}
                          >
                            {formatSignedPct(t.profitPct)} ({formatSignedUsd(t.profitUsd)})
                          </span>
                        ) : (
                          <span className="text-[14px] font-medium text-[#71717A]">-</span>
                        )}
                      </div>
                      <div className="!flex !justify-end pr-1">
                        {!selectedPortfolioReadOnly ? (
                          <TransactionRowActionsMenu
                            transaction={t}
                            isOpen={openMenuId === t.id}
                            onOpenChange={(open) => setOpenMenuId(open ? t.id : null)}
                            onEdit={openEditTransaction}
                            onRequestDelete={setDeleteCandidate}
                          />
                        ) : null}
                      </div>
                    </div>
                  ))}
                </Fragment>
              ))}
            </div>
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
