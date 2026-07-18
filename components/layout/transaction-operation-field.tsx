"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown } from "@/lib/icons";

import {
  dropdownMenuMobileSheetBodyClassName,
  dropdownMenuPanelClassName,
  dropdownMenuPlainItemRowClassName,
} from "@/components/design-system/dropdown-menu-styles";
import { MobileBottomSheet } from "@/components/ui/mobile-bottom-sheet";
import { useMobileSheet } from "@/lib/layout/use-mobile-sheet";
import { cn } from "@/lib/utils";

const OPERATIONS = ["Buy", "Sell"] as const;
export type Operation = (typeof OPERATIONS)[number];

export function TransactionOperationField({
  value: controlledValue,
  onChange,
}: {
  value?: Operation;
  onChange?: (op: Operation) => void;
} = {}) {
  const [open, setOpen] = useState(false);
  const [internalOp, setInternalOp] = useState<Operation>("Buy");
  const operation = controlledValue ?? internalOp;
  const setOperation = onChange ?? setInternalOp;
  const wrapRef = useRef<HTMLDivElement>(null);
  const isMobileSheet = useMobileSheet();

  useEffect(() => {
    if (!open || isMobileSheet) return;
    function onDocMouseDown(e: MouseEvent) {
      const el = wrapRef.current;
      if (!el || !(e.target instanceof Node) || el.contains(e.target)) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, [open, isMobileSheet]);

  const optionList = (
    <>
      {OPERATIONS.map((op) => {
        const selected = op === operation;
        return (
          <button
            key={op}
            type="button"
            role="option"
            aria-selected={selected}
            onClick={() => {
              setOperation(op);
              setOpen(false);
            }}
            className={cn(dropdownMenuPlainItemRowClassName({ selected }), "font-medium")}
          >
            <span className="min-w-0 flex-1 text-left">{op}</span>
            <span className="flex h-4 w-4 shrink-0 items-center justify-center" aria-hidden>
              <Check
                className={cn("h-4 w-4 text-[#0F0F0F]", !selected && "invisible")}
                strokeWidth={2}
              />
            </span>
          </button>
        );
      })}
    </>
  );

  return (
    <div className="relative w-full" ref={wrapRef}>
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => setOpen((o) => !o)}
        className="flex h-9 w-full items-center justify-between gap-2 rounded-[10px] bg-[#F4F4F5] px-4 text-left text-sm font-normal text-[#0F0F0F] transition-colors hover:bg-[#EBEBEB]"
      >
        <span>{operation}</span>
        <ChevronDown className="h-5 w-5 shrink-0 text-[#0F0F0F]" aria-hidden />
      </button>
      {open && isMobileSheet ? (
        <MobileBottomSheet open={open} onClose={() => setOpen(false)} title="Operation">
          <div className={dropdownMenuMobileSheetBodyClassName} role="listbox">
            {optionList}
          </div>
        </MobileBottomSheet>
      ) : null}
      {open && !isMobileSheet ? (
        <div
          role="listbox"
          className={cn(
            dropdownMenuPanelClassName(),
            "absolute left-0 right-0 top-full z-[110] mt-1",
          )}
        >
          {optionList}
        </div>
      ) : null}
    </div>
  );
}
