"use client";

import type { ReactNode } from "react";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { format, startOfDay } from "date-fns";
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
import { newHoldingId, newTransactionRowId } from "@/components/portfolio/portfolio-types";
import { usePortfolioWorkspace } from "@/components/portfolio/portfolio-workspace-context";
import { getCryptoLogoUrl } from "@/lib/crypto/crypto-logo-url";
import { fetchLiveMarketPriceClient, fetchPriceOnDateClient } from "@/lib/portfolio/client-symbol-quotes";
import { lotUnrealizedPnL, mergeBuyIntoPosition } from "@/lib/portfolio/holding-position";

const TABS = ["Trades", "Incomes", "Expenses", "Cash"] as const;

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

const usdFormatter = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const usdBalance = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

type Props = {
  open: boolean;
  onClose: () => void;
};

/**
 * New Transaction — matches Figma Web-App-Design node 8615:33802 (New Transaction modal).
 */
export function NewTransactionModal({ open, onClose }: Props) {
  const titleId = useId();
  const {
    portfolios,
    selectedPortfolioId,
    holdingsByPortfolioId,
    transactionsByPortfolioId,
    addHolding,
    addTransaction,
  } = usePortfolioWorkspace();

  const [transactionTab, setTransactionTab] = useState<(typeof TABS)[number]>("Trades");
  const [operation, setOperation] = useState<Operation>("Buy");
  const [selectedCompany, setSelectedCompany] = useState<CompanyPick | null>(null);
  const [transactionDate, setTransactionDate] = useState<Date>(() => startOfDay(new Date()));
  const [shares, setShares] = useState("");
  const [price, setPrice] = useState("");
  const [fees, setFees] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const transactionTotal = useMemo(() => {
    const line = parseAmountField(shares) * parseAmountField(price);
    return line + parseAmountField(fees);
  }, [shares, price, fees]);

  /** Same net cash as Portfolio → Cash tab (sum of ledger `sum`). */
  const currentCashBalanceUsd = useMemo(() => {
    if (selectedPortfolioId == null) return 0;
    const txs = transactionsByPortfolioId[selectedPortfolioId] ?? [];
    return txs.reduce((acc, t) => acc + t.sum, 0);
  }, [selectedPortfolioId, transactionsByPortfolioId]);

  const priceFetchGen = useRef(0);

  useEffect(() => {
    if (!open) return;
    const sym = selectedCompany?.symbol?.trim();
    if (!sym) {
      setPrice("");
      return;
    }

    const ymd = format(transactionDate, "yyyy-MM-dd");
    const gen = ++priceFetchGen.current;

    void (async () => {
      const p = await fetchPriceOnDateClient(sym, ymd);
      if (gen !== priceFetchGen.current) return;
      if (p != null) {
        setPrice(formatPriceInputFromApi(p));
      } else {
        setPrice("");
      }
    })();
  }, [open, selectedCompany?.symbol, transactionDate]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setTransactionTab("Trades");
    setOperation("Buy");
    setSelectedCompany(null);
    setTransactionDate(startOfDay(new Date()));
    setShares("");
    setPrice("");
    setFees("");
    setSubmitting(false);
  }, [open]);

  const hasSelectedPortfolio =
    selectedPortfolioId != null &&
    portfolios.some((p) => p.id === selectedPortfolioId);

  const canAdd = useMemo(() => {
    if (transactionTab !== "Trades") return false;
    if (!hasSelectedPortfolio) return false;
    if (!selectedCompany?.symbol?.trim()) return false;
    if (operation !== "Buy") return false;
    const sh = parseAmountField(shares);
    const pr = parseAmountField(price);
    return sh > 0 && pr > 0;
  }, [
    transactionTab,
    hasSelectedPortfolio,
    selectedCompany?.symbol,
    operation,
    shares,
    price,
  ]);

  const handleAdd = useCallback(async () => {
    if (!canAdd || !selectedPortfolioId || !selectedCompany) return;
    const sym = selectedCompany.symbol.trim();
    const sh = parseAmountField(shares);
    const pr = parseAmountField(price);
    const fee = parseAmountField(fees);
    if (sh <= 0 || pr <= 0) return;

    setSubmitting(true);
    try {
      const live = await fetchLiveMarketPriceClient(sym);
      const marketPrice = live ?? pr;

      let logoUrl: string | null = null;
      try {
        const res = await fetch(`/api/stocks/${encodeURIComponent(sym)}/header-meta`);
        if (res.ok) {
          const data = (await res.json()) as { logoUrl?: string | null };
          if (typeof data.logoUrl === "string" && data.logoUrl.trim()) {
            logoUrl = data.logoUrl.trim();
          }
        }
      } catch {
        logoUrl = null;
      }
      if (!logoUrl?.trim()) {
        logoUrl = getCryptoLogoUrl(sym);
      }

      const lotCost = sh * pr + fee;
      const dateStr = format(transactionDate, "yyyy-MM-dd");

      const existing =
        holdingsByPortfolioId[selectedPortfolioId]?.find(
          (h) => h.symbol.toUpperCase() === sym.toUpperCase(),
        ) ?? null;
      const positionId = existing?.id ?? newHoldingId();

      const merged = mergeBuyIntoPosition(existing, {
        id: positionId,
        symbol: sym.toUpperCase(),
        name: selectedCompany.name,
        logoUrl,
        shares: sh,
        price: pr,
        fee,
        marketPrice,
      });

      const { profitUsd, profitPct } = lotUnrealizedPnL({
        shares: sh,
        price: pr,
        fee,
        marketPrice,
      });

      addHolding(selectedPortfolioId, merged);

      addTransaction(selectedPortfolioId, {
        id: newTransactionRowId(),
        portfolioId: selectedPortfolioId,
        kind: "trade",
        operation,
        symbol: sym.toUpperCase(),
        name: selectedCompany.name,
        logoUrl,
        date: dateStr,
        shares: sh,
        price: pr,
        fee,
        sum: -lotCost,
        profitPct,
        profitUsd,
        holdingId: merged.id,
      });

      onClose();
    } finally {
      setSubmitting(false);
    }
  }, [
    addHolding,
    addTransaction,
    canAdd,
    fees,
    holdingsByPortfolioId,
    onClose,
    operation,
    price,
    selectedCompany,
    selectedPortfolioId,
    shares,
    transactionDate,
  ]);

  if (!open) return null;

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
            New Transaction
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
          <div className="flex flex-col gap-5">
            <Field label="Portfolio">
              <TransactionPortfolioField />
            </Field>

            <TransactionTypeTabs active={transactionTab} onChange={setTransactionTab} />

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

            <div className="pt-1">
              <div className="flex items-center gap-1 border-b border-dashed border-[#E4E4E7] py-2.5 text-sm">
                <span className="flex-1 font-medium text-[#71717A]">Current cash balance</span>
                <span
                  className={cn(
                    "shrink-0 font-semibold tabular-nums",
                    currentCashBalanceUsd < 0
                      ? "text-[#DC2626]"
                      : currentCashBalanceUsd > 0
                        ? "text-[#16A34A]"
                        : "text-[#09090B]",
                  )}
                >
                  {usdBalance.format(currentCashBalanceUsd)}
                </span>
              </div>
              <div className="flex items-center gap-1 py-2.5 text-sm">
                <span className="flex-1 font-medium text-[#71717A]">Total</span>
                <span className="shrink-0 font-semibold tabular-nums text-[#09090B]">
                  {usdFormatter.format(transactionTotal)}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex shrink-0 gap-3 border-t border-[#E4E4E7] px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="flex min-h-9 flex-1 items-center justify-center rounded-[10px] bg-[#F4F4F5] px-4 py-2 text-sm font-medium text-[#09090B] transition-colors hover:bg-[#EBEBEB]"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!canAdd || submitting}
            onClick={() => void handleAdd()}
            className={cn(
              "flex min-h-9 flex-1 items-center justify-center rounded-[10px] px-4 py-2 text-sm font-medium text-white transition-colors",
              canAdd && !submitting
                ? "bg-[#09090B] hover:bg-[#27272A]"
                : "cursor-not-allowed bg-[#A1A1AA] opacity-50",
            )}
          >
            {submitting ? "Adding…" : "Add"}
          </button>
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

function TransactionTypeTabs({
  active,
  onChange,
}: {
  active: (typeof TABS)[number];
  onChange: (tab: (typeof TABS)[number]) => void;
}) {
  return (
    <div className="flex gap-5 border-b border-[#E4E4E7]">
      {TABS.map((tab) => {
        const isOn = tab === active;
        return (
          <button
            key={tab}
            type="button"
            onClick={() => onChange(tab)}
            className={
              isOn
                ? "-mb-px border-b-2 border-[#09090B] pb-2 text-sm font-medium leading-6 text-[#09090B]"
                : "pb-2.5 text-sm font-medium leading-6 text-[#09090B] opacity-80 hover:opacity-100"
            }
          >
            {tab}
          </button>
        );
      })}
    </div>
  );
}
