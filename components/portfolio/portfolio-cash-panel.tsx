"use client";

import { memo, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Filter, Pencil, Search } from "lucide-react";
import { format, parseISO } from "date-fns";

import { CashInOutBarChartSection } from "@/components/portfolio/cash-in-out-bar-chart";
import { CompanyLogo } from "@/components/screener/company-logo";
import { usePortfolioWorkspace } from "@/components/portfolio/portfolio-workspace-context";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
  if (n < 0) return "text-[#DC2626]";
  if (n > 0) return "text-[#16A34A]";
  return "text-[#09090B]";
}

function formatSignedUsd(n: number): string {
  const s = usd0.format(Math.abs(n));
  return n >= 0 ? `+${s}` : `-${s}`;
}

function operationClassName(operation: string): string {
  const u = operation.toLowerCase();
  if (u.includes("cash in")) return "text-[#16A34A]";
  if (u.includes("cash out")) return "text-[#DC2626]";
  return "text-[#09090B]";
}

type CashDirectionFilter = "all" | "in" | "out";

/** Matches `ScreenerTable` / `IndicesTable` column layout tokens. */
const cashBalanceGrid =
  "grid grid-cols-[minmax(0,1fr)_minmax(0,auto)] items-center gap-x-2";

const cashTxGrid =
  "grid grid-cols-[minmax(0,100px)_minmax(0,2fr)_88px_72px_96px_minmax(0,1fr)_40px] items-center gap-x-2";

function rowMatchesCashFilter(t: PortfolioTransaction, f: CashDirectionFilter): boolean {
  if (f === "all") return true;
  const u = t.operation.toLowerCase();
  if (f === "in") return u.includes("cash in");
  return u.includes("cash out");
}

/**
 * Cash balance from ledger activity (can be negative). Styled like portfolio / screener tables.
 */
function PortfolioCashPanelInner() {
  const { selectedPortfolioId, transactionsByPortfolioId, openEditTransaction } = usePortfolioWorkspace();

  const [cashSearch, setCashSearch] = useState("");
  const [cashDateAsc, setCashDateAsc] = useState(false);
  const [cashDirectionFilter, setCashDirectionFilter] = useState<CashDirectionFilter>("all");

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

  const filterSummary =
    cashDirectionFilter === "in"
      ? "Cash In"
      : cashDirectionFilter === "out"
        ? "Cash Out"
        : null;

  return (
    <div>
      <CashInOutBarChartSection rows={cashLedgerRows} />

      <div className="w-full min-w-0 overflow-x-auto pb-8">
        <div className="divide-y divide-[#E4E4E7] border-t border-[#E4E4E7]">
          <div
            className={cn(
              cashBalanceGrid,
              "min-h-[44px] bg-white px-4 py-0 text-[14px] font-medium leading-5 text-[#71717A]",
            )}
          >
            <div className="min-w-0 text-left">Currency</div>
            <div className="justify-self-end whitespace-nowrap text-right">Balance</div>
          </div>

          <div className={cn(cashBalanceGrid, "h-[60px] max-h-[60px] bg-white px-1 transition-colors duration-75 hover:bg-neutral-50")}>
            <div className="flex min-w-0 items-center gap-3 px-3 pr-4">
              <CompanyLogo name="US Dollar" logoUrl="" symbol="USD" />
              <div className="min-w-0">
                <div className="truncate text-[14px] font-semibold leading-5 text-[#09090B]">US Dollar</div>
                <div className="text-[12px] font-normal leading-4 text-[#71717A]">USD</div>
              </div>
            </div>
            <div
              className={cn(
                "px-3 text-right font-['Inter'] text-[14px] leading-5 font-normal tabular-nums",
                balanceClassName(cashUsd),
              )}
            >
              {usd0.format(cashUsd)}
            </div>
          </div>
        </div>
      </div>

      <section className="mt-8" aria-labelledby="cash-tx-heading">
        <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <h3 id="cash-tx-heading" className="text-lg font-semibold leading-7 text-[#09090B]">
            Cash Transactions
          </h3>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[200px] max-w-full flex-1 sm:w-[260px] sm:flex-none">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#71717A]"
                aria-hidden
              />
              <input
                type="search"
                value={cashSearch}
                onChange={(e) => setCashSearch(e.target.value)}
                placeholder="Type to search..."
                className="h-9 w-full rounded-[10px] border-0 bg-[#F4F4F5] py-2 pl-9 pr-3 text-sm text-[#09090B] placeholder:text-[#71717A] outline-none focus:ring-2 focus:ring-[#09090B]/10"
                aria-label="Search cash transactions"
              />
            </div>
            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="inline-flex h-9 shrink-0 items-center gap-2 rounded-[10px] bg-[#F4F4F5] px-4 text-[14px] font-medium leading-5 text-[#09090B] transition-colors duration-100 hover:bg-[#E4E4E7] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#09090B]/15 focus-visible:ring-offset-2"
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
              <PopoverContent align="end" className="w-44 p-1">
                <div className="flex flex-col gap-0.5">
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
                        "rounded-lg px-3 py-2 text-left text-sm transition-colors",
                        cashDirectionFilter === value
                          ? "bg-[#F4F4F5] font-medium text-[#09090B]"
                          : "text-[#71717A] hover:bg-[#FAFAFA] hover:text-[#09090B]",
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {cashLedgerRows.length === 0 ? (
          <p className="py-8 text-center text-sm text-[#71717A]">No cash movements yet.</p>
        ) : filteredCashRows.length === 0 ? (
          <p className="py-8 text-center text-sm text-[#71717A]">No transactions match your search.</p>
        ) : (
          <div className="w-full min-w-0 overflow-x-auto pb-4">
            <div className="min-w-[720px] divide-y divide-[#E4E4E7] border-t border-[#E4E4E7]">
              <div
                className={cn(
                  cashTxGrid,
                  "min-h-[44px] bg-white px-4 py-0 text-[14px] font-medium leading-5 text-[#71717A] [&>div]:text-center",
                )}
              >
                <div className="!text-left">Operation</div>
                <div className="!text-left">Holding</div>
                <div>
                  <button
                    type="button"
                    onClick={() => setCashDateAsc((v) => !v)}
                    className="inline-flex items-center justify-center gap-1 rounded-md transition-colors hover:text-[#09090B] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#09090B]/15"
                  >
                    Date
                    {cashDateAsc ? (
                      <ArrowUp className="h-3.5 w-3.5 opacity-70" aria-hidden />
                    ) : (
                      <ArrowDown className="h-3.5 w-3.5 opacity-70" aria-hidden />
                    )}
                  </button>
                </div>
                <div>Fee</div>
                <div>Summ</div>
                <div className="!text-left">Note</div>
                <div className="!text-right">
                  <span className="sr-only">Actions</span>
                </div>
              </div>

              {filteredCashRows.map((t) => (
                <div
                  key={t.id}
                  className={cn(
                    cashTxGrid,
                    "h-[60px] max-h-[60px] bg-white px-1 transition-colors duration-75 hover:bg-neutral-50 [&>div]:text-center",
                  )}
                >
                  <div
                    className={cn(
                      "min-w-0 !text-left truncate px-3 text-[14px] font-medium leading-5",
                      operationClassName(t.operation),
                    )}
                  >
                    {t.operation}
                  </div>
                  <div className="min-w-0 !text-left">
                    <div className="flex min-w-0 items-center gap-3 pr-4">
                      <CompanyLogo name={t.name} logoUrl={t.logoUrl ?? ""} symbol={t.symbol} />
                      <div className="min-w-0">
                        <div className="truncate text-[14px] font-semibold leading-5 text-[#09090B]">{t.name}</div>
                        <div className="text-[12px] font-normal leading-4 text-[#71717A]">{t.symbol}</div>
                      </div>
                    </div>
                  </div>
                  <div className="font-['Inter'] text-[14px] leading-5 font-normal tabular-nums text-[#09090B]">
                    {format(parseISO(t.date), "MM/dd/yyyy")}
                  </div>
                  <div className="font-['Inter'] text-[14px] leading-5 font-normal tabular-nums text-[#09090B]">
                    {t.fee > 0 ? usd0.format(t.fee) : usd0.format(0)}
                  </div>
                  <div
                    className={cn(
                      "text-[14px] font-medium leading-5 tabular-nums",
                      balanceClassName(t.sum),
                    )}
                  >
                    {formatSignedUsd(t.sum)}
                  </div>
                  <div className="!text-left truncate px-2 text-[14px] leading-5 text-[#71717A]" />
                  <div className="!flex !justify-end pr-1">
                    <button
                      type="button"
                      aria-label="Edit transaction"
                      onClick={() => openEditTransaction(t)}
                      className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[#09090B] transition-colors hover:bg-[#F4F4F5]"
                    >
                      <Pencil className="h-4 w-4" aria-hidden strokeWidth={2} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

export const PortfolioCashPanel = memo(PortfolioCashPanelInner);
