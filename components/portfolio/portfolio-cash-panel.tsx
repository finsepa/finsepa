"use client";

import { memo, useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, Check, Filter, Search, Wallet } from "@/lib/icons";
import { format, parseISO } from "date-fns";

import { CashInOutBarChartSection } from "@/components/portfolio/cash-in-out-bar-chart";
import { DeleteTransactionConfirmModal } from "@/components/portfolio/delete-transaction-confirm-modal";
import { TransactionRowActionsMenu } from "@/components/portfolio/transaction-row-actions-menu";
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
import { displayLogoUrlForPortfolioSymbol } from "@/lib/portfolio/portfolio-asset-display-logo";
import { toastTransactionDeleted } from "@/lib/portfolio/transaction-deleted-toast";
import { portfolioAssetSymbolCaption } from "@/lib/portfolio/custom-asset-symbol";
import { usePortfolioWorkspace } from "@/components/portfolio/portfolio-workspace-context";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  dropdownMenuPanelBodyClassName,
  dropdownMenuPlainItemRowClassName,
} from "@/components/design-system/dropdown-menu-styles";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { TABLE_PAGE_SIZE, TablePaginationBar, tablePageCount } from "@/components/ui/table-pagination";
import { cn } from "@/lib/utils";
import type { PortfolioTransaction } from "@/components/portfolio/portfolio-types";

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
  if (n < 0) return "text-down";
  return "text-fg";
}

/** Summ column: green for cash / income inflows; red for outflows; black otherwise. */
function cashSummClassName(operation: string, sum: number): string {
  if (sum < 0) return "text-down";
  if (sum > 0) {
    const u = operation.toLowerCase();
    if (u.includes("cash in") || u.includes("other income")) return "text-up";
  }
  return "text-fg";
}

function formatSignedUsd(n: number): string {
  const s = usd0.format(Math.abs(n));
  return n >= 0 ? `+${s}` : `-${s}`;
}

function operationClassName(operation: string): string {
  const u = operation.toLowerCase();
  if (u.includes("cash in") || u.includes("other income")) return "text-up";
  if (u.includes("cash out") || u.includes("other expense")) return "text-down";
  return "text-fg";
}

type CashDirectionFilter = "all" | "in" | "out";

/** Matches `ScreenerTable` / `IndicesTable` column layout tokens. */
const cashBalanceGrid =
  "grid grid-cols-[minmax(0,1fr)_minmax(0,auto)] items-center gap-x-2";

const cashTxGrid =
  "grid min-w-[640px] grid-cols-[minmax(0,100px)_minmax(0,2fr)_88px_72px_96px_40px] items-center gap-x-2";

function rowMatchesCashFilter(t: PortfolioTransaction, f: CashDirectionFilter): boolean {
  if (f === "all") return true;
  const u = t.operation.toLowerCase();
  if (f === "in") return u.includes("cash in") || u.includes("other income");
  return u.includes("cash out") || u.includes("other expense");
}

function CashTableHeader({
  gridClass,
  children,
}: {
  gridClass: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        SCREENER_TABLE_HEADER_STICKY_CLASS,
        SCREENER_TABLE_ROUNDED_HEADER_CLASS,
        SCREENER_TABLE_HEADER_STROKE_HOVER_CLASS,
        "md:border-b-0",
      )}
    >
      <div className={DEFAULT_TABLE_ROW_HOVER_PAD_CLASS}>
        <div className={cn(gridClass, "min-h-[44px] text-[14px] font-medium leading-5 text-fg-muted")}>
          {children}
        </div>
      </div>
      <div className={SCREENER_TABLE_STROKE_INSET_CLASS} aria-hidden />
    </div>
  );
}

/**
 * Cash balance from ledger activity (can be negative). Styled like portfolio / screener tables.
 */
function PortfolioCashPanelInner() {
  const {
    selectedPortfolioId,
    transactionsByPortfolioId,
    openEditTransaction,
    removePortfolioTransaction,
    selectedPortfolioReadOnly,
  } = usePortfolioWorkspace();

  const [cashSearch, setCashSearch] = useState("");
  const [cashPage, setCashPage] = useState(1);
  const [cashDateAsc, setCashDateAsc] = useState(false);
  const [cashDirectionFilter, setCashDirectionFilter] = useState<CashDirectionFilter>("all");
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [deleteCandidate, setDeleteCandidate] = useState<PortfolioTransaction | null>(null);

  const handleConfirmDelete = useCallback(async () => {
    if (!deleteCandidate) return;
    const snapshot = deleteCandidate;
    await removePortfolioTransaction(snapshot);
    toastTransactionDeleted(snapshot);
  }, [deleteCandidate, removePortfolioTransaction]);

  const transactions = useMemo(
    () => (selectedPortfolioId != null ? transactionsByPortfolioId[selectedPortfolioId] ?? [] : []),
    [transactionsByPortfolioId, selectedPortfolioId],
  );

  const cashUsd = useMemo(() => netCashUsd(transactions), [transactions]);

  const cashLedgerRows = useMemo(
    () => transactions.filter((t) => t.kind === "cash"),
    [transactions],
  );

  const filteredCashRows = useMemo(() => {
    let rows = cashLedgerRows.filter((t) => rowMatchesCashFilter(t, cashDirectionFilter));
    const q = cashSearch.trim().toLowerCase();
    if (q) {
      rows = rows.filter((t) => {
        const dateFmt = format(parseISO(t.date), "MM/dd/yyyy");
        return (
          t.operation.toLowerCase().includes(q) ||
          t.name.toLowerCase().includes(q) ||
          t.symbol.toLowerCase().includes(q) ||
          t.date.toLowerCase().includes(q) ||
          dateFmt.includes(q)
        );
      });
    }
    return [...rows].sort((a, b) => {
      const ta = parseISO(a.date).getTime();
      const tb = parseISO(b.date).getTime();
      return cashDateAsc ? ta - tb : tb - ta;
    });
  }, [cashLedgerRows, cashDirectionFilter, cashSearch, cashDateAsc]);

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      setCashPage(1);
    });
    return () => cancelAnimationFrame(id);
  }, [cashDirectionFilter, cashSearch]);

  const cashPageCount = useMemo(() => tablePageCount(filteredCashRows.length), [filteredCashRows.length]);

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      setCashPage((p) => Math.min(p, cashPageCount));
    });
    return () => cancelAnimationFrame(id);
  }, [cashPageCount]);

  const safeCashPage = Math.min(Math.max(1, cashPage), cashPageCount);
  const pagedCashRows = useMemo(
    () =>
      filteredCashRows.slice((safeCashPage - 1) * TABLE_PAGE_SIZE, safeCashPage * TABLE_PAGE_SIZE),
    [filteredCashRows, safeCashPage],
  );

  const filterSummary =
    cashDirectionFilter === "in"
      ? "Cash In"
      : cashDirectionFilter === "out"
        ? "Cash Out"
        : null;

  return (
    <div>
      <CashInOutBarChartSection rows={cashLedgerRows} />

      <div className="w-full min-w-0">
        <ScreenerTableScroll>
          <div className="bg-surface">
            <CashTableHeader gridClass={cashBalanceGrid}>
              <div className={cn("min-w-0 text-left", TABLE_START_ALIGNED_PAD_CLASS)}>Currency</div>
              <div
                className={cn(
                  "justify-self-end whitespace-nowrap text-right",
                  TABLE_END_ALIGNED_PAD_CLASS,
                )}
              >
                Balance
              </div>
            </CashTableHeader>

            <div className={SCREENER_TABLE_DATA_ROW_CLASS}>
              <div className={DEFAULT_TABLE_ROW_HOVER_PAD_CLASS}>
                <div
                  className={cn(
                    cashBalanceGrid,
                    "min-h-[60px]",
                    SCREENER_TABLE_ROW_HOVER_SURFACE_CLASS,
                  )}
                >
                  <div className={cn("flex min-w-0 items-center gap-3", TABLE_START_ALIGNED_PAD_CLASS)}>
                    <CompanyLogo name="US Dollar" logoUrl="" symbol="USD" />
                    <div className="min-w-0">
                      <div className="truncate text-[14px] font-semibold leading-5 text-fg">
                        US Dollar
                      </div>
                      <div className="text-[12px] font-normal leading-4 text-fg-muted">USD</div>
                    </div>
                  </div>
                  <div
                    className={cn(
                      "justify-self-end text-right font-['Inter'] text-[14px] font-normal leading-5 tabular-nums",
                      TABLE_END_ALIGNED_PAD_CLASS,
                      balanceClassName(cashUsd),
                    )}
                  >
                    {usd0.format(cashUsd)}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </ScreenerTableScroll>
      </div>

      <section className="mt-5" aria-labelledby="cash-tx-heading">
        <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <h3 id="cash-tx-heading" className="text-lg font-semibold leading-7 text-fg">
            Cash Transactions
          </h3>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[200px] max-w-full flex-1 sm:w-[260px] sm:flex-none">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-muted"
                aria-hidden
              />
              <input
                type="search"
                value={cashSearch}
                onChange={(e) => setCashSearch(e.target.value)}
                placeholder="Type to search..."
                className="h-9 w-full rounded-[10px] border-0 bg-surface-muted py-2 pl-9 pr-3 text-sm text-fg placeholder:text-fg-muted outline-none focus:ring-2 focus:ring-fg/10"
                aria-label="Search cash transactions"
              />
            </div>
            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="inline-flex h-9 shrink-0 items-center gap-2 rounded-[10px] bg-surface-muted px-4 text-[14px] font-medium leading-5 text-fg transition-colors duration-100 hover:bg-stroke focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fg/15 focus-visible:ring-offset-2"
                >
                  <Filter className="h-4 w-4 opacity-90" aria-hidden />
                  Filter
                  {filterSummary ? (
                    <span className="max-w-[120px] truncate text-[13px] font-normal opacity-90">
                      · {filterSummary}
                    </span>
                  ) : null}
                </button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-44">
                <div className={dropdownMenuPanelBodyClassName}>
                  {(
                    [
                      ["all", "All"] as const,
                      ["in", "Cash In"] as const,
                      ["out", "Cash Out"] as const,
                    ] satisfies readonly [CashDirectionFilter, string][]
                  ).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setCashDirectionFilter(value)}
                      className={cn(
                        dropdownMenuPlainItemRowClassName({
                          selected: cashDirectionFilter === value,
                        }),
                        "text-fg",
                        cashDirectionFilter === value ? "font-medium" : "font-normal",
                      )}
                    >
                      <span className="min-w-0 flex-1 truncate text-left">{label}</span>
                      <span className="flex h-4 w-4 shrink-0 items-center justify-center" aria-hidden>
                        {cashDirectionFilter === value ? (
                          <Check className="h-4 w-4 text-fg" strokeWidth={2} />
                        ) : null}
                      </span>
                    </button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {cashLedgerRows.length === 0 ? (
          <Empty variant="card" className="min-h-[min(32vh,280px)]">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Wallet className="h-6 w-6" strokeWidth={1.75} aria-hidden />
              </EmptyMedia>
              <EmptyTitle>No cash movements yet</EmptyTitle>
              <EmptyDescription>
                Add a deposit or withdrawal with New Transaction → Cash, or import from the + menu.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : filteredCashRows.length === 0 ? (
          <p className="py-8 text-center text-sm text-fg-muted">No transactions match your search.</p>
        ) : (
          <div className="w-full min-w-0">
            {/* Mobile: remove standalone Operation column; show operation in the holding cell. */}
            <div className="sm:hidden">
              <ScreenerTableScroll>
                <div className="bg-surface">
                  <CashTableHeader gridClass="flex items-center justify-between gap-3">
                    <div className={cn("min-w-0 text-left", TABLE_START_ALIGNED_PAD_CLASS)}>Holding</div>
                    <button
                      type="button"
                      onClick={() => setCashDateAsc((v) => !v)}
                      className="inline-flex items-center gap-1 rounded-md transition-colors hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fg/15"
                    >
                      Date
                      {cashDateAsc ? (
                        <ArrowUp className="h-3.5 w-3.5 opacity-70" aria-hidden />
                      ) : (
                        <ArrowDown className="h-3.5 w-3.5 opacity-70" aria-hidden />
                      )}
                    </button>
                  </CashTableHeader>

                  {pagedCashRows.map((t, i) => (
                    <div key={t.id} className={SCREENER_TABLE_DATA_ROW_CLASS}>
                      <div className={DEFAULT_TABLE_ROW_HOVER_PAD_CLASS}>
                        <div
                          className={cn(
                            "flex min-h-[60px] min-w-0 items-center justify-between gap-3",
                            SCREENER_TABLE_ROW_HOVER_SURFACE_CLASS,
                          )}
                        >
                          <div className={cn("flex min-w-0 items-center gap-3", TABLE_START_ALIGNED_PAD_CLASS)}>
                            <CompanyLogo
                              name={t.name}
                              logoUrl={displayLogoUrlForPortfolioSymbol(t.symbol)}
                              symbol={t.symbol}
                            />
                            <div className="min-w-0">
                              <div
                                className={cn(
                                  "truncate text-[14px] font-semibold leading-5",
                                  operationClassName(t.operation),
                                )}
                              >
                                {t.operation}
                              </div>
                              <div className="truncate text-[12px] font-normal leading-4 text-fg-muted">
                                {portfolioAssetSymbolCaption(t.symbol)}
                              </div>
                            </div>
                          </div>

                          <div className="min-w-0 shrink-0 text-right">
                            <div className="font-['Inter'] text-[14px] font-normal leading-5 tabular-nums text-fg">
                              {format(parseISO(t.date), "MM/dd/yyyy")}
                            </div>
                            <div
                              className={cn(
                                "mt-0.5 text-[12px] font-medium leading-4 tabular-nums",
                                cashSummClassName(t.operation, t.sum),
                              )}
                            >
                              {formatSignedUsd(t.sum)}
                            </div>
                          </div>
                        </div>
                      </div>
                      {i < pagedCashRows.length - 1 ? (
                        <div className={SCREENER_TABLE_STROKE_INSET_CLASS} aria-hidden />
                      ) : null}
                    </div>
                  ))}
                </div>
              </ScreenerTableScroll>
            </div>

            {/* Desktop: keep the full grid table. */}
            <div className="hidden sm:block">
              <ScreenerTableScroll minWidthClassName="min-w-[640px]">
                <div className="bg-surface">
                  <CashTableHeader gridClass={cashTxGrid}>
                    <div className={cn("min-w-0 w-full text-left", TABLE_START_ALIGNED_PAD_CLASS)}>
                      Operation
                    </div>
                    <div className="min-w-0 w-full text-left">Holding</div>
                    <div className={cn("min-w-0 w-full text-right", TABLE_END_ALIGNED_PAD_CLASS)}>
                      <button
                        type="button"
                        onClick={() => setCashDateAsc((v) => !v)}
                        className="ml-auto inline-flex items-center gap-1 rounded-md transition-colors hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fg/15"
                      >
                        Date
                        {cashDateAsc ? (
                          <ArrowUp className="h-3.5 w-3.5 opacity-70" aria-hidden />
                        ) : (
                          <ArrowDown className="h-3.5 w-3.5 opacity-70" aria-hidden />
                        )}
                      </button>
                    </div>
                    <div className={cn("min-w-0 w-full text-right", TABLE_END_ALIGNED_PAD_CLASS)}>Fee</div>
                    <div className={cn("min-w-0 w-full text-right", TABLE_END_ALIGNED_PAD_CLASS)}>Summ</div>
                    <div className={cn("min-w-0 w-full text-right", TABLE_END_ALIGNED_PAD_CLASS)}>
                      <span className="sr-only">Actions</span>
                    </div>
                  </CashTableHeader>

                  {pagedCashRows.map((t, i) => (
                    <div key={t.id} className={SCREENER_TABLE_DATA_ROW_CLASS}>
                      <div className={DEFAULT_TABLE_ROW_HOVER_PAD_CLASS}>
                        <div
                          className={cn(
                            cashTxGrid,
                            "min-h-[60px] text-[14px] font-normal leading-5",
                            SCREENER_TABLE_ROW_HOVER_SURFACE_CLASS,
                          )}
                        >
                          <div
                            className={cn(
                              "min-w-0 w-full truncate text-left font-medium",
                              TABLE_START_ALIGNED_PAD_CLASS,
                              operationClassName(t.operation),
                            )}
                          >
                            {t.operation}
                          </div>
                          <div className="min-w-0 w-full text-left">
                            <div className="flex min-w-0 items-center justify-start gap-3 pr-2">
                              <CompanyLogo
                                name={t.name}
                                logoUrl={displayLogoUrlForPortfolioSymbol(t.symbol)}
                                symbol={t.symbol}
                              />
                              <div className="min-w-0">
                                <div className="truncate text-[14px] font-semibold leading-5 text-fg">
                                  {t.name}
                                </div>
                                <div className="text-[12px] font-normal leading-4 text-fg-muted">
                                  {portfolioAssetSymbolCaption(t.symbol)}
                                </div>
                              </div>
                            </div>
                          </div>
                          <div
                            className={cn(
                              "min-w-0 w-full text-right font-['Inter'] tabular-nums text-fg",
                              TABLE_END_ALIGNED_PAD_CLASS,
                            )}
                          >
                            {format(parseISO(t.date), "MM/dd/yyyy")}
                          </div>
                          <div
                            className={cn(
                              "min-w-0 w-full text-right font-['Inter'] tabular-nums text-fg",
                              TABLE_END_ALIGNED_PAD_CLASS,
                            )}
                          >
                            {t.fee > 0 ? usd0.format(t.fee) : usd0.format(0)}
                          </div>
                          <div
                            className={cn(
                              "min-w-0 w-full text-right font-medium tabular-nums",
                              TABLE_END_ALIGNED_PAD_CLASS,
                              cashSummClassName(t.operation, t.sum),
                            )}
                          >
                            {formatSignedUsd(t.sum)}
                          </div>
                          <div className={cn("flex w-full justify-end", TABLE_END_ALIGNED_PAD_CLASS)}>
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
                      </div>
                      {i < pagedCashRows.length - 1 ? (
                        <div className={SCREENER_TABLE_STROKE_INSET_CLASS} aria-hidden />
                      ) : null}
                    </div>
                  ))}
                </div>
              </ScreenerTableScroll>
            </div>
            <TablePaginationBar
              page={safeCashPage}
              totalItems={filteredCashRows.length}
              onPageChange={setCashPage}
            />
          </div>
        )}
      </section>

      <DeleteTransactionConfirmModal
        transaction={deleteCandidate}
        onClose={() => setDeleteCandidate(null)}
        onConfirmDelete={handleConfirmDelete}
      />
    </div>
  );
}

export const PortfolioCashPanel = memo(PortfolioCashPanelInner);
