"use client";

import { useEffect, useId } from "react";

import { AppModalOverlay } from "@/components/ui/app-modal-overlay";
import {
  AppModalFooter,
  AppModalShell,
  appModalCancelButtonClass,
  appModalDangerButtonClass,
} from "@/components/ui/app-modal-shell";

type Props = {
  /** When set, modal is open. */
  portfolioId: string | null;
  portfolioName: string;
  onClose: () => void;
  onConfirmDelete: () => void;
};

/**
 * Confirms permanent deletion of a portfolio and all of its holdings/transactions for that portfolio.
 */
export function DeletePortfolioConfirmModal({
  portfolioId,
  portfolioName,
  onClose,
  onConfirmDelete,
}: Props) {
  const open = portfolioId != null;
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <AppModalOverlay open={open} onClose={onClose} zIndex={300}>
      <AppModalShell
        titleId={titleId}
        title="Delete portfolio"
        onClose={onClose}
        bodyClassName="px-5 pb-2 pt-5"
        footer={
          <AppModalFooter>
            <button type="button" onClick={onClose} className={appModalCancelButtonClass}>
              Cancel
            </button>
            <button type="button" onClick={onConfirmDelete} className={appModalDangerButtonClass()}>
              Delete portfolio
            </button>
          </AppModalFooter>
        }
      >
        <p className="text-sm leading-5 text-[#0F0F0F]">
          Are you sure you want to delete{" "}
          <span className="font-semibold">{portfolioName}</span>?
        </p>
        <p className="mt-3 text-sm leading-5 text-[#71717A]">
          All related transactions and holdings for this portfolio will be removed.
        </p>
      </AppModalShell>
    </AppModalOverlay>
  );
}
