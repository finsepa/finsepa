"use client";

import { useEffect, useId, useState } from "react";
import { format } from "date-fns";

import { SnaptradeUpdateFromDateField } from "@/components/portfolio/snaptrade-update-from-date-field";
import { AppModalOverlay } from "@/components/ui/app-modal-overlay";
import {
  AppModalFooter,
  AppModalShell,
  appModalCancelButtonClass,
  appModalPrimaryButtonClass,
} from "@/components/ui/app-modal-shell";
import type { PortfolioTransaction } from "@/components/portfolio/portfolio-types";
import {
  SNAPTRADE_SYNC_FIRST_TRANSACTION_DESCRIPTION,
  SNAPTRADE_SYNC_FIRST_TRANSACTION_LABEL,
  SNAPTRADE_SYNC_WITH_DATE_DESCRIPTION,
  SNAPTRADE_SYNC_WITH_DATE_LABEL,
} from "@/lib/snaptrade/sync-copy";
import { defaultSnaptradeUpdateFromYmd } from "@/lib/snaptrade/sync-update-from";
import { SpinnerLabel } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

type SnaptradeSyncMode = "with-date" | "first-transaction";

function SnaptradeSyncModeOption({
  selected,
  label,
  description,
  onSelect,
}: {
  selected: boolean;
  label: string;
  description: string;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className="flex w-full items-start gap-3 rounded-[10px] py-1 text-left transition-colors hover:bg-surface-muted/60"
    >
      <span
        className={cn(
          "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition-colors",
          selected ? "border-fg" : "border-stroke",
        )}
        aria-hidden
      >
        {selected ? <span className="h-2 w-2 rounded-full bg-fg" /> : null}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium leading-5 text-fg">{label}</span>
        <span className="mt-0.5 block text-xs leading-5 text-fg-muted">{description}</span>
      </span>
    </button>
  );
}

export function PortfolioSnaptradeSyncModal({
  open,
  portfolioName: _portfolioName,
  transactions,
  updating,
  onClose,
  onUpdate,
}: {
  open: boolean;
  portfolioName: string;
  transactions: PortfolioTransaction[];
  updating?: boolean;
  onClose: () => void;
  onUpdate: (updateFromYmd: string | null) => void;
}) {
  const titleId = useId();
  const [mode, setMode] = useState<SnaptradeSyncMode>(() =>
    defaultSnaptradeUpdateFromYmd(transactions) ? "with-date" : "first-transaction",
  );
  const [updateFromYmd, setUpdateFromYmd] = useState<string>(() =>
    defaultSnaptradeUpdateFromYmd(transactions) ?? format(new Date(), "yyyy-MM-dd"),
  );

  useEffect(() => {
    if (!open) return;
    const defaultYmd = defaultSnaptradeUpdateFromYmd(transactions);
    if (defaultYmd) {
      setMode("with-date");
      setUpdateFromYmd(defaultYmd);
    } else {
      setMode("first-transaction");
      setUpdateFromYmd(format(new Date(), "yyyy-MM-dd"));
    }
  }, [open, transactions]);

  const selectWithDate = () => {
    setMode("with-date");
    setUpdateFromYmd((prev) => defaultSnaptradeUpdateFromYmd(transactions) ?? prev);
  };

  const canUpdate = !updating;

  return (
    <AppModalOverlay open={open} onClose={updating ? undefined : onClose} zIndex={120}>
      <AppModalShell
        titleId={titleId}
        title="Updating the data"
        onClose={onClose}
        closeDisabled={updating}
        bodyClassName="flex flex-col gap-4 px-5 pb-5 pt-5"
        maxWidthClass="w-full max-w-[440px]"
        footer={
          <AppModalFooter className="justify-end">
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={updating}
                onClick={onClose}
                className={appModalCancelButtonClass}
              >
                Close
              </button>
              <button
                type="button"
                disabled={!canUpdate}
                onClick={() => onUpdate(mode === "first-transaction" ? null : updateFromYmd)}
                className={appModalPrimaryButtonClass(canUpdate)}
              >
                {updating ? <SpinnerLabel>Updating…</SpinnerLabel> : "Update"}
              </button>
            </div>
          </AppModalFooter>
        }
      >
        <div role="radiogroup" aria-label="Sync range" className="flex flex-col gap-2">
          <SnaptradeSyncModeOption
            selected={mode === "with-date"}
            label={SNAPTRADE_SYNC_WITH_DATE_LABEL}
            description={SNAPTRADE_SYNC_WITH_DATE_DESCRIPTION}
            onSelect={selectWithDate}
          />
          <SnaptradeSyncModeOption
            selected={mode === "first-transaction"}
            label={SNAPTRADE_SYNC_FIRST_TRANSACTION_LABEL}
            description={SNAPTRADE_SYNC_FIRST_TRANSACTION_DESCRIPTION}
            onSelect={() => setMode("first-transaction")}
          />
        </div>
        {mode === "with-date" ?
          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium leading-5 text-fg">Update from</span>
            <SnaptradeUpdateFromDateField valueYmd={updateFromYmd} onChangeYmd={setUpdateFromYmd} />
          </div>
        : null}
      </AppModalShell>
    </AppModalOverlay>
  );
}
