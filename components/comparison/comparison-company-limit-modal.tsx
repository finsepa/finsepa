"use client";

import { useEffect, useId } from "react";

import { AppModalOverlay } from "@/components/ui/app-modal-overlay";
import {
  AppModalFooter,
  AppModalShell,
  appModalPrimaryButtonClass,
} from "@/components/ui/app-modal-shell";
import { COMPARISON_MAX_COMPANIES } from "@/lib/comparison/comparison-session";

export function ComparisonCompanyLimitModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
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
    <AppModalOverlay open={open} onClose={onClose}>
      <AppModalShell
        titleId={titleId}
        title="Company limit reached"
        onClose={onClose}
        bodyClassName="px-5 pb-2 pt-5"
        footer={
          <AppModalFooter className="justify-end">
            <button type="button" className={appModalPrimaryButtonClass(true)} onClick={onClose}>
              OK
            </button>
          </AppModalFooter>
        }
      >
        <p className="text-sm leading-5 text-[#09090B]">
          You can compare up to {COMPARISON_MAX_COMPANIES} companies at a time.
        </p>
        <p className="mt-3 text-sm leading-5 text-[#71717A]">
          Remove one from the list before adding another.
        </p>
      </AppModalShell>
    </AppModalOverlay>
  );
}
