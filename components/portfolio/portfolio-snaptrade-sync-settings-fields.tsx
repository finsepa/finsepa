"use client";

import { CircleQuestionMark } from "@/lib/icons";
import {
  SNAPTRADE_SYNC_SETTING_TOOLTIPS,
  type PortfolioSnaptradeSyncSettings,
} from "@/lib/snaptrade/sync-settings";
import { TopbarDelayedTooltip } from "@/components/layout/topbar-delayed-tooltip";
import { cn } from "@/lib/utils";

function SyncSettingRow({
  label,
  tooltip,
  checked,
  onChange,
}: {
  label: string;
  tooltip: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 py-1">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 shrink-0 rounded border-[#E4E4E7] text-[#09090B] focus:ring-2 focus:ring-[#09090B]/15"
      />
      <span className="min-w-0 flex-1 text-sm leading-5 text-[#09090B]">{label}</span>
      <TopbarDelayedTooltip label={tooltip} delayMs={200} zIndex={350}>
        <button
          type="button"
          tabIndex={-1}
          className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[#71717A] transition-colors hover:bg-[#F4F4F5] hover:text-[#09090B]"
          aria-label={tooltip}
          onClick={(e) => e.preventDefault()}
        >
          <CircleQuestionMark className="h-4 w-4" strokeWidth={1.75} aria-hidden />
        </button>
      </TopbarDelayedTooltip>
    </label>
  );
}

export function PortfolioSnaptradeSyncSettingsFields({
  value,
  onChange,
  className,
}: {
  value: PortfolioSnaptradeSyncSettings;
  onChange: (next: PortfolioSnaptradeSyncSettings) => void;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <span className="text-sm font-medium leading-5 text-[#09090B]">Sync settings</span>
      <div className="rounded-[10px] border border-[#E4E4E7] bg-[#FAFAFA] px-3 py-2">
        <SyncSettingRow
          label="Auto-sync once a day"
          tooltip={SNAPTRADE_SYNC_SETTING_TOOLTIPS.autoSyncDaily}
          checked={value.autoSyncDaily}
          onChange={(autoSyncDaily) => onChange({ ...value, autoSyncDaily })}
        />
        <SyncSettingRow
          label="Emulate transaction history"
          tooltip={SNAPTRADE_SYNC_SETTING_TOOLTIPS.emulateTransactionHistory}
          checked={value.emulateTransactionHistory}
          onChange={(emulateTransactionHistory) => onChange({ ...value, emulateTransactionHistory })}
        />
        <SyncSettingRow
          label="Adjust positions to brokerage"
          tooltip={SNAPTRADE_SYNC_SETTING_TOOLTIPS.adjustPositionsToBrokerage}
          checked={value.adjustPositionsToBrokerage}
          onChange={(adjustPositionsToBrokerage) => onChange({ ...value, adjustPositionsToBrokerage })}
        />
      </div>
    </div>
  );
}
