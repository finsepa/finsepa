"use client";

import type { ReactNode } from "react";
import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { format, startOfDay } from "date-fns";

import {
  CashDirectionSelect,
  type CashDirection,
  cashOperationLabel,
  cashSignedAmount,
} from "@/components/layout/cash-direction-select";
import { UsdMoneyClearableInput } from "@/components/layout/usd-money-clearable-input";
import { TransactionDateField } from "@/components/layout/transaction-date-field";
import { newTransactionRowId, portfolioIsCombined } from "@/components/portfolio/portfolio-types";
import { usePortfolioWorkspace } from "@/components/portfolio/portfolio-workspace-context";
import { AppModalOverlay } from "@/components/ui/app-modal-overlay";
import {
  AppModalFooter,
  AppModalShell,
  appModalCancelButtonClass,
  appModalPrimaryButtonClass,
} from "@/components/ui/app-modal-shell";
import { SpinnerLabel } from "@/components/ui/spinner";
import { FormListboxSelect, type ListboxOption } from "@/components/ui/form-listbox-select";
import { toastTransactionAdded } from "@/lib/portfolio/transaction-added-toast";
import { parseUsdStyleNumber } from "@/lib/portfolio/amount-input-format";

const usdFormatter = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

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

  const amountNum = useMemo(() => parseUsdStyleNumber(amount), [amount]);

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
    <AppModalOverlay open={open} onClose={onClose} zIndex={100}>
      <AppModalShell
        titleId={titleId}
        title="Add Cash"
        onClose={onClose}
        bodyClassName="px-5 pb-5 pt-5"
        footer={
          <AppModalFooter>
            <button type="button" onClick={onClose} className={appModalCancelButtonClass}>
              Cancel
            </button>
            <button
              type="button"
              disabled={!canAdd || submitting}
              onClick={() => void handleAdd()}
              className={appModalPrimaryButtonClass(canAdd && !submitting)}
            >
              {submitting ? <SpinnerLabel>Adding…</SpinnerLabel> : "Add"}
            </button>
          </AppModalFooter>
        }
      >
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
            <UsdMoneyClearableInput
              value={amount}
              onChange={setAmount}
              placeholder="0.00"
              clearLabel="Clear amount"
            />
          </Field>
        </div>
      </AppModalShell>
    </AppModalOverlay>
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
