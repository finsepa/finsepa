"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { format, startOfDay } from "date-fns";

import {
  cashOperationLabel,
  cashSignedAmount,
  type CashDirection,
} from "@/components/layout/cash-direction-select";
import { TransactionDateField } from "@/components/layout/transaction-date-field";
import { SegmentedControl, whiteSurfaceButtonChromeClass } from "@/components/design-system";
import {
  dropdownMenuPanelBodyClassName,
  dropdownMenuPlainItemRowClassName,
} from "@/components/design-system/dropdown-menu-styles";
import { newTransactionRowId, portfolioIsCombined, portfolioIsDemo } from "@/components/portfolio/portfolio-types";
import { usePortfolioWorkspace } from "@/components/portfolio/portfolio-workspace-context";
import { AppModalOverlay } from "@/components/ui/app-modal-overlay";
import { AppModalCloseButton, AppModalShell, APP_MODAL_RULE_CLASS } from "@/components/ui/app-modal-shell";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { SpinnerLabel } from "@/components/ui/spinner";
import { Check, Lock } from "@/lib/icons";
import { parseUsdStyleNumber } from "@/lib/portfolio/amount-input-format";
import {
  formatCashToastDescription,
  toastTransactionAdded,
} from "@/lib/portfolio/transaction-added-toast";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  onClose: () => void;
};

/** Top segment — matches iOS Manage Cash (Other income/expense live in a pill). */
type CashTab = "deposit" | "withdraw" | "other";
type OtherKind = "other_income" | "other_expense";

const TAB_OPTIONS = [
  { value: "deposit" as const, label: "Deposit" },
  { value: "withdraw" as const, label: "Withdraw" },
  { value: "other" as const, label: "Other" },
];

const OTHER_KIND_OPTIONS: { value: OtherKind; label: string }[] = [
  { value: "other_income", label: "Other income" },
  { value: "other_expense", label: "Other expense" },
];

const usd2 = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Form body height + section rhythm (same as Add Transaction / iOS sheet). */
const FORM_BODY_MIN_H_PX = 420;
const FORM_SECTION_GAP_PX = 32;

const HERO_DIGITS_CLASS = "text-[48px] font-semibold leading-[56px] tracking-[-0.02em] tabular-nums";

const PILL_CLASS = cn(
  "inline-flex h-9 max-w-full shrink-0 items-center gap-1.5 rounded-full px-3.5 text-sm font-medium text-fg transition-colors hover:bg-surface-muted dark:hover:bg-dropdown-item-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fg/15",
  whiteSurfaceButtonChromeClass,
);

function sanitizeAmountTyping(raw: string, maxFraction: number): string {
  let s = raw.replace(/[^0-9.]/g, "");
  const dot = s.indexOf(".");
  if (dot >= 0) s = s.slice(0, dot + 1) + s.slice(dot + 1).replace(/\./g, "");
  const [intRaw = "", frac] = s.split(".");
  const intPart = intRaw.replace(/^0+(?=\d)/, "");
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  if (frac == null) return grouped;
  return `${grouped || "0"}.${frac.slice(0, maxFraction)}`;
}

function roundUsdForDisplay(n: number): number {
  if (!Number.isFinite(n)) return 0;
  const cents = Math.round(n * 100);
  return cents === 0 ? 0 : cents / 100;
}

function directionFromUi(tab: CashTab, otherKind: OtherKind): CashDirection {
  if (tab === "deposit") return "in";
  if (tab === "withdraw") return "out";
  return otherKind;
}

/**
 * Manage Cash — same chrome as iOS / Add Transaction:
 * Deposit · Withdraw · Other → portfolio pill → hero $ amount → type/date pills.
 */
export function AddCashModal({ open, onClose }: Props) {
  const titleId = useId();
  const {
    portfolios,
    selectedPortfolioId,
    isFreePortfolioAccessible,
    transactionsByPortfolioId,
    addTransaction,
  } = usePortfolioWorkspace();

  const [tab, setTab] = useState<CashTab>("deposit");
  const [otherKind, setOtherKind] = useState<OtherKind>("other_income");
  const [date, setDate] = useState(() => startOfDay(new Date()));
  const [amount, setAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [cashPortfolioId, setCashPortfolioId] = useState("");

  const standardPortfolios = useMemo(
    () => portfolios.filter((p) => !portfolioIsCombined(p) && !portfolioIsDemo(p)),
    [portfolios],
  );

  useEffect(() => {
    if (!open) return;
    setTab("deposit");
    setOtherKind("other_income");
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

  const selectedPortfolio =
    standardPortfolios.find((p) => p.id === resolvedCashPortfolioId) ?? standardPortfolios[0] ?? null;

  const cashBalanceUsd = useMemo(() => {
    if (!resolvedCashPortfolioId) return 0;
    return roundUsdForDisplay(
      (transactionsByPortfolioId[resolvedCashPortfolioId] ?? []).reduce((acc, t) => acc + t.sum, 0),
    );
  }, [resolvedCashPortfolioId, transactionsByPortfolioId]);

  const direction = directionFromUi(tab, otherKind);
  const canAdd = resolvedCashPortfolioId.length > 0 && amountNum > 0;

  const portfolioPillLabel = selectedPortfolio
    ? `${selectedPortfolio.name} · ${usd2.format(cashBalanceUsd)}`
    : "No portfolio";

  const otherKindLabel =
    OTHER_KIND_OPTIONS.find((o) => o.value === otherKind)?.label ?? "Other income";

  const primaryToneClass =
    tab === "deposit" ? "bg-up text-white"
    : tab === "withdraw" ? "bg-down text-white"
    : "bg-fg text-surface";

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
        direction === "in" ? "Cash deposited"
        : direction === "out" ? "Cash withdrawn"
        : "Cash recorded",
        formatCashToastDescription(direction, n),
      );
      onClose();
    } finally {
      setSubmitting(false);
    }
  }, [addTransaction, amountNum, canAdd, date, direction, onClose, resolvedCashPortfolioId]);

  if (!open) return null;

  const header = (
    <div className="flex w-full items-center gap-2">
      <h2 id={titleId} className="min-w-0 flex-1 truncate text-base font-semibold leading-5 text-fg">
        Manage Cash
      </h2>
      <AppModalCloseButton onClick={onClose} disabled={submitting} />
    </div>
  );

  const footer = (
    <div className={cn("flex shrink-0 flex-col gap-3 border-t px-5 pb-5 pt-4", APP_MODAL_RULE_CLASS)}>
      <button
        type="button"
        disabled={!canAdd || submitting}
        onClick={() => void handleAdd()}
        className={cn(
          "inline-flex h-11 w-full items-center justify-center rounded-full text-[15px] font-semibold transition-opacity",
          primaryToneClass,
          (!canAdd || submitting) && "cursor-not-allowed opacity-40",
        )}
      >
        {submitting ? <SpinnerLabel>Adding…</SpinnerLabel> : "Add"}
      </button>
    </div>
  );

  return (
    <AppModalOverlay open={open} onClose={onClose} zIndex={100}>
      <AppModalShell header={header} footer={footer} bodyClassName="px-5 py-5">
        <div className="flex flex-col items-center" style={{ minHeight: FORM_BODY_MIN_H_PX }}>
          <SegmentedControl
            fullWidth
            aria-label="Direction"
            options={TAB_OPTIONS}
            value={tab}
            onChange={setTab}
          />

          <div
            className="flex w-full flex-1 flex-col items-center justify-center"
            style={{ gap: FORM_SECTION_GAP_PX, paddingTop: FORM_SECTION_GAP_PX, paddingBottom: FORM_SECTION_GAP_PX }}
          >
            {standardPortfolios.length > 0 ? (
              <Popover>
                <PopoverTrigger asChild>
                  <button type="button" className={PILL_CLASS} aria-label="Portfolio">
                    <span className="min-w-0 truncate tabular-nums">{portfolioPillLabel}</span>
                  </button>
                </PopoverTrigger>
                <PopoverContent align="center" sideOffset={6} className="w-[min(calc(100vw-2rem),300px)] overflow-hidden p-0">
                  <div className={dropdownMenuPanelBodyClassName} role="listbox" aria-label="Portfolio">
                    {standardPortfolios.map((p) => {
                      const isOn = p.id === resolvedCashPortfolioId;
                      const locked = !isFreePortfolioAccessible(p.id);
                      return (
                        <button
                          key={p.id}
                          type="button"
                          role="option"
                          aria-selected={isOn}
                          onClick={() => setCashPortfolioId(p.id)}
                          className={dropdownMenuPlainItemRowClassName({ selected: isOn })}
                        >
                          <span className="min-w-0 flex-1 truncate text-left">{p.name}</span>
                          <span className="flex h-4 w-4 shrink-0 items-center justify-center" aria-hidden>
                            {isOn ? (
                              <Check className="h-4 w-4 text-fg" strokeWidth={2} />
                            ) : locked ? (
                              <Lock className="h-3.5 w-3.5 text-fg-muted" strokeWidth={2} />
                            ) : null}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </PopoverContent>
              </Popover>
            ) : (
              <p className="text-center text-sm leading-5 text-fg-muted">
                Create a standard portfolio to record cash movements.
              </p>
            )}

            <CashHeroAmount
              value={amount}
              onChange={(v) => setAmount(sanitizeAmountTyping(v, 2))}
            />

            <div className="flex flex-wrap items-center justify-center gap-2">
              {tab === "other" ? (
                <Popover>
                  <PopoverTrigger asChild>
                    <button type="button" className={PILL_CLASS} aria-label={`Type, ${otherKindLabel}`}>
                      {otherKindLabel}
                    </button>
                  </PopoverTrigger>
                  <PopoverContent align="center" sideOffset={6} className="w-[200px] overflow-hidden p-0">
                    <div className={dropdownMenuPanelBodyClassName} role="listbox" aria-label="Type">
                      {OTHER_KIND_OPTIONS.map((o) => (
                        <button
                          key={o.value}
                          type="button"
                          role="option"
                          aria-selected={o.value === otherKind}
                          onClick={() => setOtherKind(o.value)}
                          className={dropdownMenuPlainItemRowClassName({ selected: o.value === otherKind })}
                        >
                          <span className="min-w-0 flex-1 truncate text-left">{o.label}</span>
                          <span className="flex h-4 w-4 shrink-0 items-center justify-center" aria-hidden>
                            {o.value === otherKind ? (
                              <Check className="h-4 w-4 text-fg" strokeWidth={2} />
                            ) : null}
                          </span>
                        </button>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>
              ) : null}
              <TransactionDateField date={date} onDateChange={setDate} pillClassName={PILL_CLASS} />
            </div>
          </div>
        </div>
      </AppModalShell>
    </AppModalOverlay>
  );
}

/** Centered hero `$` amount — same rhythm as Add Transaction expense entry. */
function CashHeroAmount({
  value,
  onChange,
}: {
  value: string;
  onChange: (next: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const measureRef = useRef<HTMLSpanElement>(null);
  const placeholder = "0.00";
  const isEmpty = value.length === 0;

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useLayoutEffect(() => {
    const input = inputRef.current;
    const measure = measureRef.current;
    if (!input || !measure) return;
    input.style.width = `${Math.ceil(measure.getBoundingClientRect().width) + 2}px`;
  }, [value]);

  return (
    <div className="flex w-full flex-col items-center gap-0.5">
      <div
        className="relative flex max-w-full cursor-text items-baseline justify-center gap-0.5"
        onClick={() => inputRef.current?.focus()}
      >
        <span className="text-[17px] font-medium text-fg-muted">$</span>
        <span
          ref={measureRef}
          aria-hidden
          className={cn(HERO_DIGITS_CLASS, "pointer-events-none invisible absolute whitespace-pre")}
        >
          {value || placeholder}
        </span>
        <span className="relative inline-flex max-w-[260px] items-baseline">
          {isEmpty ? (
            <span aria-hidden className={cn(HERO_DIGITS_CLASS, "pointer-events-none text-fg-muted")}>
              {placeholder}
            </span>
          ) : null}
          <input
            ref={inputRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            inputMode="decimal"
            aria-label="Amount"
            autoComplete="off"
            className={cn(
              HERO_DIGITS_CLASS,
              "min-w-0 bg-transparent text-left text-fg caret-fg outline-none",
              isEmpty ? "absolute inset-0 w-full" : "relative max-w-[260px]",
            )}
          />
        </span>
      </div>
      <p className="text-[15px] text-fg-muted">Amount</p>
    </div>
  );
}
