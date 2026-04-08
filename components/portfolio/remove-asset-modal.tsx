"use client";

import { useEffect, useId } from "react";
import { X } from "lucide-react";

import type { PortfolioHolding } from "@/components/portfolio/portfolio-types";

type Props = {
  holding: PortfolioHolding | null;
  onClose: () => void;
  onConfirmRemove: () => void;
};

/**
 * Confirms removal of a holding row and all ledger rows for the same ticker in this portfolio.
 */
export function RemoveAssetModal({ holding, onClose, onConfirmRemove }: Props) {
  const open = holding != null;
  const titleId = useId();

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
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!holding) return null;

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center bg-black/40 p-4"
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
            Remove asset
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

        <div className="px-5 pb-2 pt-5">
          <p className="text-sm leading-5 text-[#09090B]">
            Are you sure you want to delete{" "}
            <span className="font-semibold">
              {holding.name} ({holding.symbol})
            </span>
            ?
          </p>
          <p className="mt-3 text-sm leading-5 text-[#71717A]">
            All the related transactions for this asset are going to be removed.
          </p>
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
            onClick={onConfirmRemove}
            className="flex min-h-9 flex-1 items-center justify-center rounded-[10px] bg-[#DC2626] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#B91C1C]"
          >
            Remove
          </button>
        </div>
      </div>
    </div>
  );
}
