"use client";

import type { ReactNode } from "react";
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { format, startOfDay } from "date-fns";

import {
  CASH_DIRECTION_OPTIONS,
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
import {
  formatCashToastDescription,
  toastTransactionAdded,
} from "@/lib/portfolio/transaction-added-toast";
import { parseUsdStyleNumber } from "@/lib/portfolio/amount-input-format";
import { cn } from "@/lib/utils";

const CASH_TAB_MOTION_MS = 280;
const CASH_TAB_MOTION_EASE = "cubic-bezier(0.33, 1, 0.68, 1)";

type Props = {
  open: boolean;
  onClose: () => void;
};

/**
 * Add cash — same shell as New Transaction / Create portfolio (rounded card, Cancel + Add).
 * Operation type uses underline tabs (same pattern as New Transaction Trades/Incomes/Expenses).
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
      toastTransactionAdded(
        direction === "in" ? "Cash deposited" : direction === "out" ? "Cash withdrawn" : "Cash recorded",
        formatCashToastDescription(direction, n),
      );
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
        className="dark:!border-field-stroke"
        cardClassName="dark:border-transparent"
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
            <p className="text-sm leading-5 text-fg-muted">
              Create a standard portfolio to record cash movements.
            </p>
          )}

          <CashOperationTabs active={direction} onChange={setDirection} />

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
      <span className="text-sm font-medium leading-5 text-fg">{label}</span>
      {children}
    </div>
  );
}

/** Underline tabs — same motion/chrome as New Transaction type tabs. */
function CashOperationTabs({
  active,
  onChange,
}: {
  active: CashDirection;
  onChange: (next: CashDirection) => void;
}) {
  const navRef = useRef<HTMLElement>(null);
  const tabRefs = useRef(new Map<CashDirection, HTMLButtonElement>());
  const [indicator, setIndicator] = useState({ left: 0, width: 0 });
  const [indicatorMotionEnabled, setIndicatorMotionEnabled] = useState(false);
  const hasPositionedOnceRef = useRef(false);

  const measureIndicator = useCallback(() => {
    const nav = navRef.current;
    const btn = tabRefs.current.get(active);
    if (!nav || !btn) return;
    const navRect = nav.getBoundingClientRect();
    const btnRect = btn.getBoundingClientRect();
    const width = Math.round(btnRect.width);
    if (width <= 0) return;
    const left = Math.round(btnRect.left - navRect.left + nav.scrollLeft);
    setIndicator((prev) => {
      if (prev.left === left && prev.width === width) return prev;
      return { left, width };
    });
  }, [active]);

  useLayoutEffect(() => {
    measureIndicator();
    if (hasPositionedOnceRef.current) return;
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      measureIndicator();
      raf2 = requestAnimationFrame(() => {
        if (hasPositionedOnceRef.current) return;
        const btn = tabRefs.current.get(active);
        if (!btn || btn.getBoundingClientRect().width <= 0) return;
        hasPositionedOnceRef.current = true;
        setIndicatorMotionEnabled(true);
      });
    });
    return () => {
      cancelAnimationFrame(raf1);
      if (raf2) cancelAnimationFrame(raf2);
    };
  }, [measureIndicator, active]);

  useLayoutEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    const ro = new ResizeObserver(measureIndicator);
    ro.observe(nav);
    window.addEventListener("resize", measureIndicator);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measureIndicator);
    };
  }, [measureIndicator]);

  return (
    <div className="w-full border-b border-stroke">
      <nav
        ref={navRef}
        className="relative flex w-full flex-nowrap items-start gap-5 overflow-x-auto pb-px [-webkit-overflow-scrolling:touch]"
        aria-label="Operation type"
        role="tablist"
      >
        {CASH_DIRECTION_OPTIONS.map((opt) => {
          const isOn = opt.value === active;
          return (
            <button
              key={opt.value}
              ref={(el) => {
                if (el) tabRefs.current.set(opt.value, el);
                else tabRefs.current.delete(opt.value);
              }}
              type="button"
              role="tab"
              aria-selected={isOn}
              onClick={() => onChange(opt.value)}
              className={cn(
                "-mb-px shrink-0 cursor-pointer border-b-2 border-transparent py-2 text-sm font-medium leading-6 transition-[color,opacity] duration-100 hover:opacity-100",
                isOn ? "font-semibold text-fg opacity-100" : "text-fg opacity-80",
              )}
            >
              {opt.label}
            </button>
          );
        })}
        <span
          className="pointer-events-none absolute bottom-0 z-[1] h-0.5 rounded-full bg-fg motion-reduce:transition-none"
          style={{
            left: indicator.left,
            width: indicator.width,
            opacity: indicator.width > 0 ? 1 : 0,
            transitionProperty: indicatorMotionEnabled ? "left, width" : "none",
            transitionDuration: indicatorMotionEnabled ? `${CASH_TAB_MOTION_MS}ms` : "0ms",
            transitionTimingFunction: CASH_TAB_MOTION_EASE,
          }}
          aria-hidden
        />
      </nav>
    </div>
  );
}
