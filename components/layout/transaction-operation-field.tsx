"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";

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

  useEffect(() => {
    if (!open) return;
    function onDocMouseDown(e: MouseEvent) {
      const el = wrapRef.current;
      if (!el || !(e.target instanceof Node) || el.contains(e.target)) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, [open]);

  return (
    <div className="relative w-full" ref={wrapRef}>
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => setOpen((o) => !o)}
        className="flex h-9 w-full items-center justify-between gap-2 rounded-[10px] bg-[#F4F4F5] px-4 text-left text-sm font-normal text-[#09090B] transition-colors hover:bg-[#EBEBEB]"
      >
        <span>{operation}</span>
        <ChevronDown className="h-5 w-5 shrink-0 text-[#09090B]" aria-hidden />
      </button>
      {open ? (
        <div
          role="listbox"
          className="absolute left-0 right-0 top-full z-[110] mt-1 overflow-hidden rounded-[10px] border border-[#E4E4E7] bg-white py-1 shadow-[0px_4px_12px_0px_rgba(10,10,10,0.08)]"
        >
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
                className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-sm font-medium text-[#09090B] transition-colors hover:bg-[#F4F4F5]"
              >
                <span>{op}</span>
                {selected ? <Check className="h-4 w-4 shrink-0 text-[#09090B]" strokeWidth={2} aria-hidden /> : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
