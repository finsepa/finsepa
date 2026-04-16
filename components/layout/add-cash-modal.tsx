"use client";

import type { ReactNode } from "react";
import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { format, startOfDay } from "date-fns";
import { X } from "lucide-react";

import {
  CashDirectionSelect,
  type CashDirection,
  cashOperationLabel,
  cashSignedAmount,
} from "@/components/layout/cash-direction-select";
import { ClearableInput } from "@/components/layout/clearable-input";
import { TransactionDateField } from "@/components/layout/transaction-date-field";
import { newTransactionRowId, portfolioIsCombined } from "@/components/portfolio/portfolio-types";
import { usePortfolioWorkspace } from "@/components/portfolio/portfolio-workspace-context";
import { FormListboxSelect, type ListboxOption } from "@/components/ui/form-listbox-select";
import { toastTransactionAdded } from "@/lib/portfolio/transaction-added-toast";
import { cn } from "@/lib/utils";

const usdFormatter = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
function parseAmountField(raw: string): number {
  const t = raw.trim().replace(/\s/g, "").replace(",", ".");
  if (!t) return 0;
  const n = Number.parseFloat(t);
  return Number.isFinite(n) ? n : 0;
}

type Props = {
  open: boolean;
  onClose: () => void;
};

/**
 * Add cash — same shell as New Transaction / Create portfolio (rounded card, Cancel + Add).
 */
export function AddCashModal({ open, onClose }: Props) {
  const titleId = useId();
  const { portfolios, selectedPortfolioId, addTransaction } = usePortfolioWorkspace();

  const [direction, setDirection] = useState<CashDirection>("in");
  const [date, setDate] = useState(() => startOfDay(new Date()));
  const [amount, setAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [cashPortfolioId, setCashPortfolioId] = useState("");

  const standardPortfolios = useMemo(
    () => portfolios.filter((p) => !portfolioIsCombined(p)),
    [portfolios],
  );

  const portfolioOptions = useMemo((): ListboxOption<string>[] => {
    return standardPortfolios.map((p) => ({ value: p.id, label: p.name }));
  }, [standardPortfolios]);

  useEffect(() => {
    if (!open) return;
    setDirection("in");
    setDate(startOfDay(new Date()));
    setAmount("");
    setSubmitting(false);
    const preferred =
      selectedPortfolioId && standardPortfolios.some((p) => p.id === selectedPortfolioId)
        ? selectedPortfolioId
        : (standardPortfolios[0]?.id ?? "");
    setCashPortfolioId(preferred);
  }, [open, selectedPortfolioId, standardPortfolios]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const amountNum = useMemo(() => parseAmountField(amount), [amount]);

  const resolvedCashPortfolioId = useMemo(() => {
    if (cashPortfolioId && standardPortfolios.some((p) => p.id === cashPortfolioId)) return cashPortfolioId;
    return standardPortfolios[0]?.id ?? "";
  }, [cashPortfolioId, standardPortfolios]);

  const canAdd = resolvedCashPortfolioId.length > 0 && amountNum > 0;

  const handleAdd = useCallback(() => {
    if (!canAdd || !resolvedCashPortfolioId) return;
    const n = amountNum;
    if (n <= 0) return;

    setSubmitting(true);
    try {
      const dateStr = format(date, "yyyy-MM-dd");
      const opLabel = cashOperationLabel(direction);
      addTransaction(resolvedCashPortfolioId, {
        id: newTransactionRowId(),
        portfolioId: resolvedCashPortfolioId,
        kind: "cash",
        operation: opLabel,
        symbol: "USD",
        name: "US Dollar",
        logoUrl: null,
        date: dateStr,
        shares: n,
        price: 1,
        fee: 0,
        sum: cashSignedAmount(direction, n),
        profitPct: null,
        profitUsd: null,
      });
      const toastHeadline =
        direction === "in" || direction === "out"
          ? `${direction === "in" ? "Cash in" : "Cash out"} of ${usdFormatter.format(n)} added.`
          : `${opLabel} of ${usdFormatter.format(n)} recorded.`;
      toastTransactionAdded(toastHeadline, date);
      onClose();
    } finally {
      setSubmitting(false);
    }
  }, [addTransaction, amountNum, canAdd, date, direction, onClose, resolvedCashPortfolioId]);

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
        className="flex w-full max-w-[480px] flex-col rounded-xl bg-white shadow-[0px_10px_16px_-3px_rgba(10,10,10,0.1),0px_4px_6px_0px_rgba(10,10,10,0.04)]"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-[#E4E4E7] px-5 py-3">
          <h2 id={titleId} className="text-lg font-semibold leading-7 tracking-tight text-[#09090B]">
            Add Cash
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

        <div className="px-5 pb-5 pt-5">
          <div className="flex flex-col gap-5">
            {portfolioOptions.length > 0 ? (
              <Field label="Portfolio">
                <FormListboxSelect
                  listboxClassName="z-[120]"
                  value={resolvedCashPortfolioId}
                  onChange={setCashPortfolioId}
                  options={portfolioOptions}
                  aria-label="Portfolio to add cash to"
                />
              </Field>
            ) : (
              <p className="text-sm leading-5 text-[#71717A]">
                Create a standard portfolio to record cash movements.
              </p>
            )}

            <Field label="Operation type">
              <CashDirectionSelect value={direction} onChange={setDirection} />
            </Field>

            <Field label="Date">
              <TransactionDateField date={date} onDateChange={setDate} />
            </Field>

            <Field label="Amount">
              <ClearableInput
                type="number"
                inputMode="decimal"
                min="0"
                step="any"
                value={amount}
                onChange={setAmount}
                placeholder="0.00"
                clearLabel="Clear amount"
              />
            </Field>
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
