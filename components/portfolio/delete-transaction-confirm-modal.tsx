"use client";

import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import { format, parseISO } from "date-fns";
import { X } from "lucide-react";

import type { PortfolioTransaction } from "@/components/portfolio/portfolio-types";

type Props = {
  transaction: PortfolioTransaction | null;
  onClose: () => void;
  /** Called before close; may be async (e.g. rebuild holdings). */
  onConfirmDelete: () => void | Promise<void>;
};

export function DeleteTransactionConfirmModal({ transaction, onClose, onConfirmDelete }: Props) {
  const open = transaction != null;
  const titleId = useId();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) setBusy(false);
  }, [open]);

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
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !busy) onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, busy, onClose]);

  if (!open || !transaction) return null;

  const dateLabel = format(parseISO(transaction.date), "MMM d, yyyy");

  return createPortal(
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center bg-black/40 p-4"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
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
            Delete transaction
          </h2>
          <button
            type="button"
            onClick={() => !busy && onClose()}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] text-[#09090B] transition-colors hover:bg-[#F4F4F5]"
            aria-label="Close"
          >
            <X className="h-5 w-5" strokeWidth={2} />
          </button>
        </div>

        <div className="px-5 pb-2 pt-5">
          <p className="text-sm leading-5 text-[#09090B]">
            Remove this{" "}
            <span className="font-semibold">
              {transaction.operation}
            </span>{" "}
            for{" "}
            <span className="font-semibold">
              {transaction.name} ({transaction.symbol})
            </span>{" "}
            on {dateLabel}?
          </p>
          <p className="mt-3 text-sm leading-5 text-[#71717A]">
            Your portfolio value and holdings will be recalculated without this row.
          </p>
        </div>

        <div className="flex shrink-0 gap-3 border-t border-[#E4E4E7] px-6 py-4">
          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            className="flex min-h-9 flex-1 items-center justify-center rounded-[10px] bg-[#F4F4F5] px-4 py-2 text-sm font-medium text-[#09090B] transition-colors hover:bg-[#EBEBEB] disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              void (async () => {
                setBusy(true);
                try {
                  await Promise.resolve(onConfirmDelete());
                  onClose();
                } finally {
                  setBusy(false);
                }
              })();
            }}
            className="flex min-h-9 flex-1 items-center justify-center rounded-[10px] bg-[#DC2626] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#B91C1C] disabled:opacity-50"
          >
            {busy ? "Deleting…" : "Delete"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
