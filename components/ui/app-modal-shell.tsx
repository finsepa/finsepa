"use client";

import type { ReactNode } from "react";
import { X } from "@/lib/icons";

import { APP_MODAL_DIALOG_ENTER_CLASS } from "@/components/ui/app-modal-overlay";
import { cn } from "@/lib/utils";

export const APP_MODAL_SHELL_SHADOW_CLASS =
  "shadow-[0px_10px_16px_-3px_rgba(10,10,10,0.1),0px_4px_6px_0px_rgba(10,10,10,0.04)]";

export const APP_MODAL_SHELL_OUTER_CLASS = cn(
  "rounded-2xl bg-[#F4F4F5] p-1",
  APP_MODAL_SHELL_SHADOW_CLASS,
);

export const APP_MODAL_SHELL_CARD_CLASS =
  "flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-[#E4E4E7] bg-white shadow-[0px_1px_2px_0px_rgba(10,10,10,0.06)]";

export const APP_MODAL_TITLE_CLASS = "text-base font-semibold leading-7 text-[#09090B]";

export const appModalCancelButtonClass =
  "inline-flex min-h-9 shrink-0 items-center justify-center rounded-[10px] bg-[#F4F4F5] px-4 py-2 text-sm font-medium text-[#09090B] transition-colors hover:bg-[#EBEBEB] disabled:cursor-not-allowed disabled:opacity-50";

export function appModalPrimaryButtonClass(enabled: boolean) {
  return cn(
    "inline-flex min-h-9 shrink-0 items-center justify-center rounded-[10px] px-4 py-2 text-sm font-medium text-white transition-colors",
    enabled ? "bg-[#09090B] hover:bg-[#27272A]" : "cursor-not-allowed bg-[#A1A1AA] opacity-50",
  );
}

export function appModalDangerButtonClass(enabled = true) {
  return cn(
    "inline-flex min-h-9 shrink-0 items-center justify-center rounded-[10px] px-4 py-2 text-sm font-medium text-white transition-colors",
    enabled ? "bg-[#DC2626] hover:bg-[#B91C1C]" : "cursor-not-allowed bg-[#A1A1AA] opacity-50",
  );
}

export function AppModalCloseButton({
  onClick,
  disabled,
  className,
}: {
  onClick: () => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex h-7 w-7 shrink-0 items-center justify-center rounded-[10px] text-[#09090B] transition-colors hover:bg-[#EBEBEB] disabled:cursor-not-allowed disabled:opacity-40",
        className,
      )}
      aria-label="Close"
    >
      <X className="h-5 w-5" strokeWidth={2} />
    </button>
  );
}

export function AppModalFooter({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-between gap-3 border-t border-[#E4E4E7] px-6 py-4",
        className,
      )}
    >
      {children}
    </div>
  );
}

type AppModalShellProps = {
  titleId?: string;
  title?: ReactNode;
  onClose?: () => void;
  closeDisabled?: boolean;
  showClose?: boolean;
  /** Replaces the default title row (include close button in custom header when needed). */
  header?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  maxWidthClass?: string;
  maxHeightClass?: string;
  className?: string;
  dialogClassName?: string;
  headerClassName?: string;
  bodyClassName?: string;
  cardClassName?: string;
  bodyScroll?: boolean;
  /** Skip the inner white card — children render directly under the header. */
  bareBody?: boolean;
};

export function AppModalShell({
  titleId,
  title,
  onClose,
  closeDisabled,
  showClose = true,
  header,
  children,
  footer,
  maxWidthClass = "w-full max-w-[480px]",
  maxHeightClass = "max-h-[min(90vh,804px)]",
  className,
  dialogClassName,
  headerClassName,
  bodyClassName,
  cardClassName,
  bodyScroll = true,
  bareBody = false,
}: AppModalShellProps) {
  const showDefaultHeader = header == null && (title != null || (showClose && onClose != null));

  return (
    <div
      className={cn(APP_MODAL_DIALOG_ENTER_CLASS, APP_MODAL_SHELL_OUTER_CLASS, maxWidthClass, className)}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={cn("flex min-h-0 w-full flex-col", maxHeightClass, dialogClassName)}
      >
        {header != null ? (
          <div className={cn("flex shrink-0 px-4 py-3", headerClassName)}>{header}</div>
        ) : showDefaultHeader ? (
          <div className={cn("flex shrink-0 items-center justify-between gap-3 px-4 py-3", headerClassName)}>
            {title != null ? (
              <h2 id={titleId} className={cn(APP_MODAL_TITLE_CLASS, "min-w-0 truncate")}>
                {title}
              </h2>
            ) : (
              <span className="min-w-0 flex-1" />
            )}
            {showClose && onClose ? (
              <AppModalCloseButton onClick={onClose} disabled={closeDisabled} />
            ) : null}
          </div>
        ) : null}

        {bareBody ? (
          children
        ) : (
          <div className={cn(APP_MODAL_SHELL_CARD_CLASS, cardClassName)}>
            <div
              className={cn(
                "min-h-0 flex-1",
                bodyScroll ? "overflow-y-auto" : "overflow-hidden",
                bodyClassName,
              )}
            >
              {children}
            </div>
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
