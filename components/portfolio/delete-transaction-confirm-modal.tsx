"use client";

import { useEffect, useId, useState } from "react";
import { format, parseISO } from "date-fns";

import type { PortfolioTransaction } from "@/components/portfolio/portfolio-types";
import { AppModalOverlay } from "@/components/ui/app-modal-overlay";
import {
  AppModalFooter,
  AppModalShell,
  appModalCancelButtonClass,
  appModalDangerButtonClass,
} from "@/components/ui/app-modal-shell";

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
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !busy) onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, busy, onClose]);

  if (!open || !transaction) return null;

  const dateLabel = format(parseISO(transaction.date), "MMM d, yyyy");

  return (
    <AppModalOverlay open={open} onClose={busy ? undefined : onClose} zIndex={300}>
      <AppModalShell
        titleId={titleId}
        title="Delete transaction"
        onClose={onClose}
        closeDisabled={busy}
        bodyClassName="px-5 pb-2 pt-5"
        footer={
          <AppModalFooter>
            <button type="button" disabled={busy} onClick={onClose} className={appModalCancelButtonClass}>
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
              className={appModalDangerButtonClass(!busy)}
            >
              {busy ? "Deleting…" : "Delete"}
            </button>
          </AppModalFooter>
        }
      >
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
      </AppModalShell>
    </AppModalOverlay>
  );
}

type BulkProps = {
  count: number;
  onClose: () => void;
  onConfirmDelete: () => void | Promise<void>;
};

export function BulkDeleteTransactionsConfirmModal({ count, onClose, onConfirmDelete }: BulkProps) {
  const open = count > 0;
  const titleId = useId();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) setBusy(false);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !busy) onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, busy, onClose]);

  if (!open) return null;

  const label = count === 1 ? "1 transaction" : `${count} transactions`;

  return (
    <AppModalOverlay open={open} onClose={busy ? undefined : onClose} zIndex={300}>
      <AppModalShell
        titleId={titleId}
        title="Delete transactions"
        onClose={onClose}
        closeDisabled={busy}
        bodyClassName="px-5 pb-2 pt-5"
        footer={
          <AppModalFooter>
            <button type="button" disabled={busy} onClick={onClose} className={appModalCancelButtonClass}>
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
              className={appModalDangerButtonClass(!busy)}
            >
              {busy ? "Deleting…" : "Delete"}
            </button>
          </AppModalFooter>
        }
      >
        <p className="text-sm leading-5 text-[#09090B]">
          Permanently remove <span className="font-semibold">{label}</span> from this portfolio?
        </p>
        <p className="mt-3 text-sm leading-5 text-[#71717A]">
          Your portfolio value and holdings will be recalculated without these rows.
        </p>
      </AppModalShell>
    </AppModalOverlay>
  );
}
