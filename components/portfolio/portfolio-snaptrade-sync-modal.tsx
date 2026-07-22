"use client";

import { useEffect, useId, useState } from "react";

import { SnaptradeUpdateFromDateField } from "@/components/portfolio/snaptrade-update-from-date-field";
import { AppModalOverlay } from "@/components/ui/app-modal-overlay";
import {
  AppModalFooter,
  AppModalShell,
  appModalCancelButtonClass,
  appModalPrimaryButtonClass,
} from "@/components/ui/app-modal-shell";
import type { PortfolioTransaction } from "@/components/portfolio/portfolio-types";
import { defaultSnaptradeUpdateFromYmd } from "@/lib/snaptrade/sync-update-from";
import { SpinnerLabel } from "@/components/ui/spinner";

export function PortfolioSnaptradeSyncModal({
  open,
  portfolioName,
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
  const [updateFromYmd, setUpdateFromYmd] = useState<string | null>(() =>
    defaultSnaptradeUpdateFromYmd(transactions),
  );

  useEffect(() => {
    if (!open) return;
    setUpdateFromYmd(defaultSnaptradeUpdateFromYmd(transactions));
  }, [open, transactions]);

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
                onClick={() => onUpdate(updateFromYmd)}
                className={appModalPrimaryButtonClass(canUpdate)}
              >
                {updating ? <SpinnerLabel>Updating…</SpinnerLabel> : "Update"}
              </button>
            </div>
          </AppModalFooter>
        }
      >
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium leading-5 text-[#0F0F0F]">Update from</span>
          <SnaptradeUpdateFromDateField valueYmd={updateFromYmd} onChangeYmd={setUpdateFromYmd} />
        </div>
        <p className="text-xs leading-5 text-[#71717A]">
          Syncing <span className="font-medium text-[#0F0F0F]">{portfolioName}</span> with your
          brokerage.{" "}
          {updateFromYmd ?
            <>
              From this date we <span className="font-medium text-[#0F0F0F]">add or refresh</span>{" "}
              broker transactions — older rows stay. Cash/position reconcile runs only on a full
              sync.
            </>
          : (
            <>
              <span className="font-medium text-[#0F0F0F]">First transaction</span> reloads full
              broker history and replaces prior broker rows (manual entries are kept).
            </>
          )}
        </p>
      </AppModalShell>
    </AppModalOverlay>
  );
}
