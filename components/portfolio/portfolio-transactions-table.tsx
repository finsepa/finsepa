"use client";

import {
  Fragment,
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from "react";
import { ArrowDown, ArrowUp, Check, ListX, Minus, Search } from "lucide-react";
import { format, parseISO } from "date-fns";
import { toast } from "sonner";

import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  BulkDeleteTransactionsConfirmModal,
  DeleteTransactionConfirmModal,
} from "@/components/portfolio/delete-transaction-confirm-modal";
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
  "grid grid-cols-[36px_minmax(200px,2.4fr)_minmax(88px,1fr)_minmax(108px,1.1fr)_minmax(80px,1fr)_minmax(96px,1.1fr)_minmax(64px,0.85fr)_minmax(96px,1.1fr)_minmax(128px,1.35fr)_40px] items-center gap-x-2";

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

/** Figma: 16×16, radius 4px; default white + #E4E4E7 stroke; hover #F4F4F5 fill; active #2563EB + check. */
function TxBulkCheckbox({
  checked,
  indeterminate,
  onChange,
  ariaLabel,
  inputRef,
}: {
  checked: boolean;
  indeterminate?: boolean;
  onChange: () => void;
  ariaLabel: string;
  inputRef?: RefObject<HTMLInputElement | null>;
}) {
  const on = checked || !!indeterminate;
  return (
    <label
      className={cn(
        "relative flex h-4 w-4 shrink-0 cursor-pointer items-center justify-center rounded-[4px] border transition-colors",
        "focus-within:outline-none focus-within:ring-2 focus-within:ring-[#2563EB]/30 focus-within:ring-offset-2",
        on
          ? "border-[#2563EB] bg-[#2563EB] hover:bg-[#1D4ED8]"
          : "border-[#E4E4E7] bg-white hover:bg-[#F4F4F5]",
      )}
    >
      <input
        ref={inputRef}
        type="checkbox"
        checked={checked}
        onChange={onChange}
        aria-label={ariaLabel}
        {...(indeterminate ? { "aria-checked": "mixed" as const } : {})}
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
      />
      {checked ? (
        <Check className="pointer-events-none h-2.5 w-2.5 text-white" strokeWidth={2.75} aria-hidden />
      ) : indeterminate ? (
        <Minus className="pointer-events-none h-2.5 w-2.5 text-white" strokeWidth={2.75} aria-hidden />
      ) : null}
    </label>
  );
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
  const {
    openEditTransaction,
    removePortfolioTransaction,
    removePortfolioTransactions,
    selectedPortfolioReadOnly,
  } = usePortfolioWorkspace();
  const [filter, setFilter] = useState<TxFilter>("All");
  const [txSearch, setTxSearch] = useState("");
  const [page, setPage] = useState(1);
  const [dateDesc, setDateDesc] = useState(true);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [deleteCandidate, setDeleteCandidate] = useState<PortfolioTransaction | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [bulkDeleteIds, setBulkDeleteIds] = useState<Set<string> | null>(null);
  const selectAllRef = useRef<HTMLInputElement>(null);

  const portfolioId = transactions[0]?.portfolioId ?? null;

  const handleConfirmDelete = useCallback(async () => {
    if (!deleteCandidate) return;
    const snapshot = deleteCandidate;
    await removePortfolioTransaction(snapshot);
    toastTransactionDeleted(snapshot);
  }, [deleteCandidate, removePortfolioTransaction]);

  const handleBulkConfirmDelete = useCallback(async () => {
    if (!bulkDeleteIds?.size || !portfolioId) return;
    const n = bulkDeleteIds.size;
    await removePortfolioTransactions(portfolioId, bulkDeleteIds);
    setOpenMenuId(null);
    setSelectedIds(new Set());
    toast.success(n === 1 ? "1 transaction deleted." : `${n} transactions deleted.`);
  }, [bulkDeleteIds, portfolioId, removePortfolioTransactions]);

  useEffect(() => {
    setSelectedIds(new Set());
  }, [filter, txSearch]);

  useEffect(() => {
    const valid = new Set(transactions.map((t) => t.id));
    setSelectedIds((prev) => {
      let removed = false;
      const next = new Set<string>();
      for (const id of prev) {
        if (valid.has(id)) next.add(id);
        else removed = true;
      }
      if (!removed && next.size === prev.size) return prev;
      return next;
    });
  }, [transactions]);

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
    const id = requestAnimationFrame(() => {
      setPage(1);
    });
    return () => cancelAnimationFrame(id);
  }, [filter, dateDesc, txSearch]);

  const txPageCount = useMemo(() => tablePageCount(flatSorted.length), [flatSorted.length]);

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      setPage((p) => Math.min(p, txPageCount));
    });
    return () => cancelAnimationFrame(id);
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

  const pageRowIds = useMemo(() => pageSlice.map((t) => t.id), [pageSlice]);
  const allPageSelected =
    pageRowIds.length > 0 && pageRowIds.every((id) => selectedIds.has(id));
  const somePageSelected = pageRowIds.some((id) => selectedIds.has(id)) && !allPageSelected;

  useEffect(() => {
    const el = selectAllRef.current;
    if (el) el.indeterminate = somePageSelected;
  }, [somePageSelected]);

  const toggleSelectAllPage = useCallback(() => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allPageSelected) {
        for (const id of pageRowIds) next.delete(id);
      } else {
        for (const id of pageRowIds) next.add(id);
      }
      return next;
    });
  }, [allPageSelected, pageRowIds]);

  const toggleRowSelected = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectedCount = selectedIds.size;
  const showBulkBar = !selectedPortfolioReadOnly && selectedCount > 0;

  return (
    <div>
      <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <h2 className="text-lg font-semibold leading-7 text-[#09090B]">Transactions</h2>
        {showBulkBar ? (
          <div className="flex w-full min-w-0 flex-wrap items-center justify-end gap-3 sm:w-auto">
            <span className="text-sm font-medium leading-5 text-[#71717A]">
              {selectedCount === 1 ? "1 selected" : `${selectedCount} selected`}
            </span>
            <button
              type="button"
              onClick={() => {
                setOpenMenuId(null);
                setBulkDeleteIds(new Set(selectedIds));
              }}
              className="h-9 shrink-0 rounded-[10px] bg-[#DC2626] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#B91C1C] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#DC2626]/40 focus-visible:ring-offset-2"
            >
              Delete
            </button>
          </div>
        ) : (
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
        )}
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
                  "min-h-[44px] bg-white px-1 py-0 text-[14px] font-medium leading-5 text-[#71717A]",
                )}
              >
                <div className="flex items-center justify-center">
                  {!selectedPortfolioReadOnly ? (
                    <TxBulkCheckbox
                      inputRef={selectAllRef}
                      checked={allPageSelected}
                      indeterminate={somePageSelected}
                      onChange={toggleSelectAllPage}
                      ariaLabel="Select all transactions on this page"
                    />
                  ) : null}
                </div>
                <div className="min-w-0 text-left align-middle pr-2">Asset</div>
                <div className="text-right">Operation</div>
                <div className="text-right">
                  <button
                    type="button"
                    onClick={() => setDateDesc((v) => !v)}
                    className="inline-flex items-center gap-1 rounded-md transition-colors hover:text-[#09090B] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#09090B]/15"
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
                <div className="text-right">Shares</div>
                <div className="text-right">Price</div>
                <div className="text-right">Fee</div>
                <div className="text-right">Summ</div>
                <div className="text-right">Total profit</div>
                <div className="text-right">
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
                        "h-[60px] max-h-[60px] bg-white px-1 transition-colors duration-75 hover:bg-neutral-50",
                      )}
                    >
                      <div className="flex items-center justify-center align-middle">
                        {!selectedPortfolioReadOnly ? (
                          <TxBulkCheckbox
                            checked={selectedIds.has(t.id)}
                            onChange={() => toggleRowSelected(t.id)}
                            ariaLabel={`Select transaction ${t.name}`}
                          />
                        ) : null}
                      </div>
                      <div className="min-w-0 text-left align-middle">
                        <div className="flex min-w-0 items-center gap-3 pr-2 text-left">
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
                          "min-w-0 truncate px-1 text-right text-[14px] font-medium leading-5 align-middle",
                          opColorClass(t.operation),
                        )}
                      >
                        {t.operation}
                      </div>
                      <div className="text-right font-['Inter'] text-[14px] leading-5 font-normal tabular-nums text-[#09090B] align-middle">
                        {format(parseISO(t.date), "MMM d, yyyy")}
                      </div>
                      <div className="text-right font-['Inter'] text-[14px] leading-5 font-normal tabular-nums text-[#09090B] align-middle">
                        {new Intl.NumberFormat("en-US", { maximumFractionDigits: 6 }).format(t.shares)}
                      </div>
                      <div className="text-right font-['Inter'] text-[14px] leading-5 font-normal tabular-nums text-[#09090B] align-middle">
                        {formatPortfolioUsdPerUnit(t.price)}
                      </div>
                      <div className="text-right font-['Inter'] text-[14px] leading-5 font-normal tabular-nums text-[#09090B] align-middle">
                        {t.fee > 0 ? usd.format(t.fee) : "—"}
                      </div>
                      <div
                        className={cn(
                          "text-right text-[14px] font-medium leading-5 tabular-nums align-middle",
                          sumColorClass(t.sum),
                        )}
                      >
                        {formatSignedUsd(t.sum)}
                      </div>
                      <div className="min-w-0 text-right text-[14px] font-medium leading-5 align-middle">
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
                      <div className="flex justify-end pr-1 align-middle">
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

      {bulkDeleteIds != null && bulkDeleteIds.size > 0 ? (
        <BulkDeleteTransactionsConfirmModal
          count={bulkDeleteIds.size}
          onClose={() => setBulkDeleteIds(null)}
          onConfirmDelete={handleBulkConfirmDelete}
        />
      ) : null}
    </div>
  );
}

export const PortfolioTransactionsTable = memo(PortfolioTransactionsTableInner);
