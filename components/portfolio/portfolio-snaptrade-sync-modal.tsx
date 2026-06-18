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
import { Loader2 } from "@/lib/icons";

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
                {updating ?
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                    Updating…
                  </span>
                : "Update"}
              </button>
            </div>
          </AppModalFooter>
        }
      >
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium leading-5 text-[#09090B]">Update from</span>
          <SnaptradeUpdateFromDateField valueYmd={updateFromYmd} onChangeYmd={setUpdateFromYmd} />
        </div>
        <p className="text-xs leading-5 text-[#71717A]">
          Syncing <span className="font-medium text-[#09090B]">{portfolioName}</span> with your
          brokerage. Holdings and cash always refresh; transaction import starts from the date above.
        </p>
      </AppModalShell>
    </AppModalOverlay>
  );
}
