"use client";

import { Fragment, memo, useMemo, useState } from "react";
import { ArrowDownUp, MoreHorizontal } from "lucide-react";
import { format, parseISO } from "date-fns";

import { CompanyLogo } from "@/components/screener/company-logo";
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

function PortfolioTransactionsTableInner({ transactions }: { transactions: PortfolioTransaction[] }) {
  const [filter, setFilter] = useState<TxFilter>("All");

  const filtered = useMemo(
    () => transactions.filter((t) => filterMatches(t.kind, filter)),
    [transactions, filter],
  );

  const grouped = useMemo(() => {
    const sorted = [...filtered].sort(
      (a, b) => parseISO(b.date).getTime() - parseISO(a.date).getTime(),
    );
    const map = new Map<string, PortfolioTransaction[]>();
    for (const t of sorted) {
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
  }, [filtered]);

  if (transactions.length === 0) {
    return (
      <div className="flex min-h-[min(40vh,360px)] flex-col items-center justify-center rounded-[12px] border border-[#E4E4E7] bg-white px-6 py-16 text-center">
        <p className="text-lg font-semibold text-[#09090B]">No transactions</p>
        <p className="mt-1 text-sm text-[#71717A]">Add a trade or cash movement to see it here.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-lg font-semibold leading-7 text-[#09090B]">Transactions</h2>
        <div className="flex flex-wrap items-center gap-2">
          {FILTERS.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={cn(
                "rounded-[10px] px-5 py-2 text-[14px] font-medium leading-5 text-[#09090B] transition-colors duration-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#09090B]/15 focus-visible:ring-offset-2",
                f === filter ? "bg-[#F4F4F5]" : "hover:bg-[#F4F4F5]/80",
              )}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="py-8 text-center text-sm text-[#71717A]">No transactions in this category.</p>
      ) : (
        <div className="w-full overflow-x-auto pb-8">
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
                <th className="w-12 pb-3 pr-0 font-medium" aria-label="Actions" />
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
                          <CompanyLogo name={t.name} logoUrl={t.logoUrl ?? ""} symbol={t.symbol} />
                          <div className="min-w-0">
                            <div className="font-semibold text-[#09090B]">{t.name}</div>
                            <div className="text-xs text-[#71717A]">{t.symbol}</div>
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
                        {usd.format(t.price)}
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
                        <button
                          type="button"
                          aria-label="More"
                          className="inline-flex h-8 w-8 items-center justify-center rounded-full text-[#09090B] transition-colors hover:bg-[#F4F4F5]"
                        >
                          <MoreHorizontal className="h-5 w-5" aria-hidden />
                        </button>
                      </td>
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export const PortfolioTransactionsTable = memo(PortfolioTransactionsTableInner);
