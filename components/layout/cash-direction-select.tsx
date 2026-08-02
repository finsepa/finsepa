"use client";

import { useCallback, useLayoutEffect, useRef, useState } from "react";

import { FormListboxSelect, type ListboxOption } from "@/components/ui/form-listbox-select";
import { cn } from "@/lib/utils";

export type CashDirection = "in" | "out" | "other_income" | "other_expense";

export const CASH_DIRECTION_OPTIONS: ListboxOption<CashDirection>[] = [
  { value: "in", label: "Cash In" },
  { value: "out", label: "Cash Out" },
  { value: "other_income", label: "Other income" },
  { value: "other_expense", label: "Other expense" },
];

const OPTIONS = CASH_DIRECTION_OPTIONS;

const CASH_TAB_MOTION_MS = 280;
const CASH_TAB_MOTION_EASE = "cubic-bezier(0.33, 1, 0.68, 1)";

/** Stored on `PortfolioTransaction.operation` for cash rows. */
export function cashOperationLabel(d: CashDirection): string {
  return OPTIONS.find((o) => o.value === d)?.label ?? "Cash In";
}

/** Signed ledger `sum` for a cash amount entered as a positive number. */
export function cashSignedAmount(d: CashDirection, amountPositive: number): number {
  return d === "in" || d === "other_income" ? amountPositive : -amountPositive;
}

export function cashDirectionFromOperation(operation: string): CashDirection {
  const op = operation.trim();
  if (op === "Cash In") return "in";
  if (op === "Cash Out") return "out";
  if (op === "Other income") return "other_income";
  if (op === "Other expense") return "other_expense";
  const u = op.toLowerCase();
  if (u.includes("cash out")) return "out";
  if (u.includes("other expense")) return "other_expense";
  if (u.includes("other income")) return "other_income";
  return "in";
}

export function CashDirectionSelect({
  id,
  value,
  onChange,
  "aria-label": ariaLabel = "Operation type",
}: {
  id?: string;
  value: CashDirection;
  onChange: (next: CashDirection) => void;
  "aria-label"?: string;
}) {
  return (
    <FormListboxSelect
      id={id}
      value={value}
      onChange={onChange}
      options={OPTIONS}
      aria-label={ariaLabel}
    />
  );
}

/** Underline tabs — same motion/chrome as New Transaction type tabs. */
export function CashOperationTabs({
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
