"use client";

import { useEffect, useId, useState } from "react";

import { TopbarDelayedTooltip } from "@/components/layout/topbar-delayed-tooltip";
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
  defaultSnaptradeUpdateFromYmd,
  SNAPTRADE_UPDATE_FROM_TOOLTIP,
} from "@/lib/snaptrade/sync-update-from";
import { CircleQuestionMark, Loader2 } from "@/lib/icons";

function ModalFieldLabel({
  label,
  tooltip,
}: {
  label: string;
  tooltip: string;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-sm font-medium leading-5 text-[#09090B]">{label}</span>
      <TopbarDelayedTooltip label={tooltip} delayMs={200} zIndex={350}>
        <button
          type="button"
          tabIndex={-1}
          className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-[#71717A] transition-colors hover:bg-[#F4F4F5] hover:text-[#09090B]"
          aria-label={tooltip}
          onClick={(e) => e.preventDefault()}
        >
          <CircleQuestionMark className="h-4 w-4" strokeWidth={1.75} aria-hidden />
        </button>
      </TopbarDelayedTooltip>
    </div>
  );
}

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
          <ModalFieldLabel label="Update from…" tooltip={SNAPTRADE_UPDATE_FROM_TOOLTIP} />
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
