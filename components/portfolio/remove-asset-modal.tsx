"use client";

import { useEffect, useId } from "react";

import type { PortfolioHolding } from "@/components/portfolio/portfolio-types";
import { AppModalOverlay } from "@/components/ui/app-modal-overlay";
import {
  AppModalFooter,
  AppModalShell,
  appModalCancelButtonClass,
  appModalDangerButtonClass,
} from "@/components/ui/app-modal-shell";

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
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!holding) return null;

  return (
    <AppModalOverlay open={open} onClose={onClose} zIndex={300}>
      <AppModalShell
        titleId={titleId}
        title="Remove asset"
        onClose={onClose}
        bodyClassName="px-5 pb-2 pt-5"
        footer={
          <AppModalFooter>
            <button type="button" onClick={onClose} className={appModalCancelButtonClass}>
              Cancel
            </button>
            <button type="button" onClick={onConfirmRemove} className={appModalDangerButtonClass()}>
              Remove
            </button>
          </AppModalFooter>
        }
      >
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
      </AppModalShell>
    </AppModalOverlay>
  );
}
