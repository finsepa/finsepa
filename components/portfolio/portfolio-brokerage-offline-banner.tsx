"use client";

import { useRouter } from "next/navigation";

import { accentFillButtonClassName } from "@/components/design-system/secondary-button-styles";
import { PATH_ACCOUNT_PLANS } from "@/lib/auth/routes";
import { cn } from "@/lib/utils";

/** Banner above offline brokerage portfolios (frozen after Free disconnect). */
export function PortfolioBrokerageOfflineBanner({
  brokerageName,
  className,
  canReconnect = false,
  onReconnect,
}: {
  brokerageName?: string | null;
  className?: string;
  /** Pro users can re-link SnapTrade into this portfolio. */
  canReconnect?: boolean;
  onReconnect?: () => void;
}) {
  const router = useRouter();
  const label = brokerageName?.trim() || "your brokerage";

  return (
    <div
      className={cn(
        "mb-5 flex flex-col gap-3 rounded-2xl border border-stroke bg-surface-muted/60 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4",
        className,
      )}
      role="status"
    >
      <div className="min-w-0 space-y-1">
        <p className="text-[14px] font-semibold leading-5 text-fg">Offline brokerage snapshot</p>
        <p className="text-[13px] leading-5 text-fg-muted">
          {canReconnect ?
            <>
              This is a saved read-only copy from {label}. Reconnect your brokerage to resume live
              sync and edits.
            </>
          : <>
              This is a saved read-only copy from {label}. Sync and edits are frozen on Free — data is
              not live.
            </>
          }
        </p>
      </div>
      <button
        type="button"
        onClick={() => {
          if (canReconnect && onReconnect) {
            onReconnect();
            return;
          }
          router.push(PATH_ACCOUNT_PLANS);
        }}
        className={cn(accentFillButtonClassName, "w-full shrink-0 sm:w-auto")}
      >
        {canReconnect ? "Reconnect brokerage" : "Upgrade to reconnect"}
      </button>
    </div>
  );
}
