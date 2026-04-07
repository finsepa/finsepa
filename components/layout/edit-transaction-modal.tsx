"use client";

import type { ReactNode } from "react";
import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { format, parseISO, startOfDay } from "date-fns";
import { X } from "lucide-react";

import type { CompanyPick } from "@/components/charting/company-picker";
import { cn } from "@/lib/utils";
import { ClearableInput } from "@/components/layout/clearable-input";
import { TransactionCompanyField } from "@/components/layout/transaction-company-field";
import { TransactionDateField } from "@/components/layout/transaction-date-field";
import {
  TransactionOperationField,
  type Operation,
} from "@/components/layout/transaction-operation-field";
import { TransactionPortfolioField } from "@/components/portfolio/transaction-portfolio-field";
import type { PortfolioTransaction } from "@/components/portfolio/portfolio-types";
import { usePortfolioWorkspace } from "@/components/portfolio/portfolio-workspace-context";
import { lotUnrealizedPnL } from "@/lib/portfolio/holding-position";
import {
  refreshHoldingMarketPrices,
  replayTradeTransactionsToHoldings,
} from "@/lib/portfolio/rebuild-holdings-from-trades";

function formatPriceInputFromApi(n: number): string {
  if (!Number.isFinite(n)) return "";
  return n.toFixed(4).replace(/\.?0+$/, "") || "0";
}

function parseAmountField(raw: string): number {
  const t = raw.trim().replace(/\s/g, "").replace(",", ".");
  if (!t) return 0;
  const n = Number.parseFloat(t);
  return Number.isFinite(n) ? n : 0;
}

function operationToBuySell(operation: string): Operation {
  return operation.toLowerCase().includes("sell") ? "Sell" : "Buy";
}

type Props = {
  open: boolean;
  onClose: () => void;
  transaction: PortfolioTransaction | null;
};

export function EditTransactionModal({ open, onClose, transaction }: Props) {
  const titleId = useId();
  const { transactionsByPortfolioId, setPortfolioTransactions, setPortfolioHoldings } =
    usePortfolioWorkspace();

  const [selectedCompany, setSelectedCompany] = useState<CompanyPick | null>(null);
  const [operation, setOperation] = useState<Operation>("Buy");
  const [transactionDate, setTransactionDate] = useState<Date>(() => startOfDay(new Date()));
  const [shares, setShares] = useState("");
  const [price, setPrice] = useState("");
  const [fees, setFees] = useState("");
  const [cashDirection, setCashDirection] = useState<"in" | "out">("in");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open || !transaction) return;
    if (transaction.kind === "trade") {
      setSelectedCompany({ symbol: transaction.symbol, name: transaction.name });
      setOperation(operationToBuySell(transaction.operation));
      setTransactionDate(startOfDay(parseISO(transaction.date)));
      setShares(
        Number.isInteger(transaction.shares) && transaction.shares === Math.floor(transaction.shares)
          ? String(transaction.shares)
          : String(transaction.shares),
      );
      setPrice(formatPriceInputFromApi(transaction.price));
      setFees(transaction.fee > 0 ? String(transaction.fee) : "");
    } else if (transaction.kind === "cash") {
      const u = transaction.operation.toLowerCase();
      setCashDirection(u.includes("out") ? "out" : "in");
      setTransactionDate(startOfDay(parseISO(transaction.date)));
      setShares(String(transaction.shares));
    }
    setSubmitting(false);
  }, [open, transaction]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const isTrade = transaction?.kind === "trade";
  const isCash = transaction?.kind === "cash";
  const isIncome = transaction?.kind === "income";

  const portfolioId = transaction?.portfolioId ?? null;

  const canSaveTrade = useMemo(() => {
    if (!isTrade || !portfolioId || !transaction) return false;
    if (!selectedCompany?.symbol?.trim()) return false;
    const sh = parseAmountField(shares);
    const pr = parseAmountField(price);
    if (sh <= 0 || pr <= 0) return false;
    return true;
  }, [isTrade, portfolioId, selectedCompany?.symbol, shares, price, transaction]);

  const canSaveCash = useMemo(() => {
    if (!isCash || !portfolioId || !transaction) return false;
    return parseAmountField(shares) > 0;
  }, [isCash, portfolioId, shares, transaction]);

  const handleSaveTrade = useCallback(async () => {
    if (!canSaveTrade || !portfolioId || !transaction || !selectedCompany) return;
    const sym = selectedCompany.symbol.trim().toUpperCase();
    const sh = parseAmountField(shares);
    const pr = parseAmountField(price);
    const fee = parseAmountField(fees);
    const dateStr = format(transactionDate, "yyyy-MM-dd");

    setSubmitting(true);
    try {
      let marketPrice = pr;
      try {
        const res = await fetch(`/api/stocks/${encodeURIComponent(sym)}/performance`);
        if (res.ok) {
          const data = (await res.json()) as { price?: number | null };
          if (typeof data.price === "number" && Number.isFinite(data.price) && data.price > 0) {
            marketPrice = data.price;
          }
        }
      } catch {
        /* keep pr */
      }

      let logoUrl: string | null = transaction.logoUrl;
      try {
        const res = await fetch(`/api/stocks/${encodeURIComponent(sym)}/header-meta`);
        if (res.ok) {
          const data = (await res.json()) as { logoUrl?: string | null };
          if (typeof data.logoUrl === "string" && data.logoUrl.trim()) {
            logoUrl = data.logoUrl.trim();
          }
        }
      } catch {
        /* keep */
      }

      const opLabel = operation === "Buy" ? "Buy" : "Sell";
      const lotCost = sh * pr + fee;
      const sum =
        operation === "Buy" ? -lotCost : Math.max(0, sh * pr - fee);

      const pnl =
        operation === "Buy"
          ? lotUnrealizedPnL({
              shares: sh,
              price: pr,
              fee,
              marketPrice,
            })
          : { profitUsd: null as number | null, profitPct: null as number | null };

      const updated: PortfolioTransaction = {
        ...transaction,
        operation: opLabel,
        symbol: sym,
        name: selectedCompany.name,
        logoUrl,
        date: dateStr,
        shares: sh,
        price: pr,
        fee,
        sum,
        profitPct: pnl.profitPct,
        profitUsd: pnl.profitUsd,
      };

      const list = transactionsByPortfolioId[portfolioId] ?? [];
      const next = list.map((t) => (t.id === transaction.id ? updated : t));
      setPortfolioTransactions(portfolioId, next);

      const rebuilt = replayTradeTransactionsToHoldings(next);
      const quoted = await refreshHoldingMarketPrices(rebuilt);
      setPortfolioHoldings(portfolioId, quoted);

      onClose();
    } finally {
      setSubmitting(false);
    }
  }, [
    canSaveTrade,
    fees,
    onClose,
    operation,
    portfolioId,
    selectedCompany,
    setPortfolioHoldings,
    setPortfolioTransactions,
    shares,
    price,
    transaction,
    transactionDate,
    transactionsByPortfolioId,
  ]);

  const handleSaveCash = useCallback(() => {
    if (!canSaveCash || !portfolioId || !transaction) return;
    const n = parseAmountField(shares);
    if (n <= 0) return;
    const dateStr = format(transactionDate, "yyyy-MM-dd");
    const updated: PortfolioTransaction = {
      ...transaction,
      operation: cashDirection === "in" ? "Cash In" : "Cash Out",
      date: dateStr,
      shares: n,
      price: 1,
      fee: 0,
      sum: cashDirection === "in" ? n : -n,
    };
    const list = transactionsByPortfolioId[portfolioId] ?? [];
    const next = list.map((t) => (t.id === transaction.id ? updated : t));
    setPortfolioTransactions(portfolioId, next);
    onClose();
  }, [
    canSaveCash,
    cashDirection,
    onClose,
    portfolioId,
    setPortfolioTransactions,
    shares,
    transaction,
    transactionDate,
    transactionsByPortfolioId,
  ]);

  if (!open || !transaction) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="flex max-h-[min(90vh,804px)] w-full max-w-[480px] flex-col rounded-xl bg-white shadow-[0px_10px_16px_-3px_rgba(10,10,10,0.1),0px_4px_6px_0px_rgba(10,10,10,0.04)] min-h-0"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-[#E4E4E7] px-5 py-3">
          <h2 id={titleId} className="text-lg font-semibold leading-7 tracking-tight text-[#09090B]">
            Edit Transaction
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] text-[#09090B] transition-colors hover:bg-[#F4F4F5]"
            aria-label="Close"
          >
            <X className="h-5 w-5" strokeWidth={2} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5 pt-5">
          {isIncome ? (
            <p className="text-sm text-[#71717A]">This transaction type cannot be edited here yet.</p>
          ) : isCash ? (
            <div className="flex flex-col gap-5">
              <Field label="Portfolio">
                <TransactionPortfolioField />
              </Field>
              <Field label="Direction">
                <div className="inline-flex rounded-[10px] bg-[#F4F4F5] p-0.5">
                  <button
                    type="button"
                    onClick={() => setCashDirection("in")}
                    className={cn(
                      "rounded-[8px] px-3 py-1.5 text-[13px] font-medium leading-5 transition-all",
                      cashDirection === "in"
                        ? "bg-white text-[#09090B] shadow-[0px_1px_2px_0px_rgba(10,10,10,0.06)]"
                        : "text-[#71717A] hover:text-[#09090B]",
                    )}
                  >
                    Cash In
                  </button>
                  <button
                    type="button"
                    onClick={() => setCashDirection("out")}
                    className={cn(
                      "rounded-[8px] px-3 py-1.5 text-[13px] font-medium leading-5 transition-all",
                      cashDirection === "out"
                        ? "bg-white text-[#09090B] shadow-[0px_1px_2px_0px_rgba(10,10,10,0.06)]"
                        : "text-[#71717A] hover:text-[#09090B]",
                    )}
                  >
                    Cash Out
                  </button>
                </div>
              </Field>
              <Field label="Date">
                <TransactionDateField date={transactionDate} onDateChange={setTransactionDate} />
              </Field>
              <Field label="Amount (USD)">
                <ClearableInput
                  type="number"
                  inputMode="decimal"
                  min="0"
                  value={shares}
                  onChange={setShares}
                  placeholder="Amount"
                  clearLabel="Clear amount"
                />
              </Field>
            </div>
          ) : (
            <div className="flex flex-col gap-5">
              <Field label="Portfolio">
                <TransactionPortfolioField />
              </Field>
              <Field label="Ticker/Company">
                <TransactionCompanyField value={selectedCompany} onChange={setSelectedCompany} />
              </Field>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Operation">
                  <TransactionOperationField value={operation} onChange={setOperation} />
                </Field>
                <Field label="Date">
                  <TransactionDateField date={transactionDate} onDateChange={setTransactionDate} />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Shares">
                  <ClearableInput
                    type="number"
                    inputMode="decimal"
                    min="0"
                    value={shares}
                    onChange={setShares}
                    placeholder="Shares"
                    clearLabel="Clear shares"
                  />
                </Field>
                <Field label="Price">
                  <ClearableInput
                    type="number"
                    inputMode="decimal"
                    min="0"
                    value={price}
                    onChange={setPrice}
                    placeholder="Price"
                    clearLabel="Clear price"
                  />
                </Field>
              </div>
              <Field label="Fees">
                <ClearableInput
                  type="number"
                  inputMode="decimal"
                  min="0"
                  value={fees}
                  onChange={setFees}
                  placeholder="Fee"
                  clearLabel="Clear fees"
                />
              </Field>
            </div>
          )}
        </div>

        <div className="flex shrink-0 gap-3 border-t border-[#E4E4E7] px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="flex min-h-9 flex-1 items-center justify-center rounded-[10px] bg-[#F4F4F5] px-4 py-2 text-sm font-medium text-[#09090B] transition-colors hover:bg-[#EBEBEB]"
          >
            Cancel
          </button>
          {isIncome ? null : (
            <button
              type="button"
              disabled={(!canSaveTrade && !canSaveCash) || submitting || portfolioId == null}
              onClick={() => {
                if (isCash) handleSaveCash();
                else void handleSaveTrade();
              }}
              className={cn(
                "flex min-h-9 flex-1 items-center justify-center rounded-[10px] px-4 py-2 text-sm font-medium text-white transition-colors",
                (isCash ? canSaveCash : canSaveTrade) && !submitting && portfolioId != null
                  ? "bg-[#09090B] hover:bg-[#27272A]"
                  : "cursor-not-allowed bg-[#A1A1AA] opacity-50",
              )}
            >
              {submitting ? "Saving…" : "Save"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex w-full flex-col gap-2">
      <span className="text-sm font-medium leading-5 text-[#09090B]">{label}</span>
      {children}
    </div>
  );
}
