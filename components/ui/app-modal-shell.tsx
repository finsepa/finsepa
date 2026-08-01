"use client";

import type { ReactNode } from "react";
import { X } from "@/lib/icons";

import { APP_MODAL_DIALOG_ENTER_CLASS } from "@/components/ui/app-modal-overlay";
import { whiteSurfaceButtonChromeClass } from "@/components/design-system/secondary-button-styles";
import { cn } from "@/lib/utils";

export const APP_MODAL_SHELL_SHADOW_CLASS =
  "shadow-[0px_10px_16px_-3px_rgba(var(--fs-shadow-rgb),var(--fs-shadow-a-10)),0px_4px_6px_0px_rgba(var(--fs-shadow-rgb),var(--fs-shadow-a-04))]";

/**
 * Modal chrome frame — title sits here.
 * Light: page wash. Dark: glass via `--fs-modal-title*` (stronger blur than dropdowns).
 */
export const APP_MODAL_SHELL_OUTER_CLASS = cn(
  "rounded-2xl bg-page p-1",
  "dark:border dark:border-modal-title-stroke dark:bg-modal-title/70 dark:backdrop-blur-3xl dark:backdrop-saturate-150",
  APP_MODAL_SHELL_SHADOW_CLASS,
);

/**
 * Inner modal card (form body).
 * Light: dropdown chrome. Dark: page fill + shell stroke (matches panel / top bar).
 */
export const APP_MODAL_SHELL_CARD_CLASS =
  "flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-dropdown-stroke bg-dropdown shadow-[0px_1px_2px_0px_rgba(var(--fs-shadow-rgb),var(--fs-shadow-a-06))] dark:border-stroke-shell dark:bg-page";

/**
 * Horizontal / edge rules inside modal cards — dark matches panel/top-bar shell stroke.
 * Use with `border-b` / `border-t` (e.g. `border-b ${APP_MODAL_RULE_CLASS}`).
 */
export const APP_MODAL_RULE_CLASS = "border-stroke dark:border-stroke-shell";

export const APP_MODAL_TITLE_CLASS = "text-base font-semibold leading-7 text-fg";

export const appModalCancelButtonClass = cn(
  "inline-flex min-h-9 shrink-0 items-center justify-center rounded-[10px] px-3 py-2 text-sm font-medium text-fg transition-colors hover:bg-surface-muted dark:hover:bg-dropdown-item-hover disabled:cursor-not-allowed disabled:opacity-50",
  whiteSurfaceButtonChromeClass,
);

export function appModalPrimaryButtonClass(enabled: boolean) {
  return cn(
    "inline-flex min-h-9 shrink-0 items-center justify-center rounded-[10px] px-3 py-2 text-sm font-medium text-surface transition-colors",
    enabled ? "bg-fg hover:bg-fg" : "cursor-not-allowed bg-fg-subtle opacity-50",
  );
}

export function appModalDangerButtonClass(enabled = true) {
  return cn(
    "inline-flex min-h-9 shrink-0 items-center justify-center rounded-[10px] px-3 py-2 text-sm font-medium text-white transition-colors",
    enabled ? "bg-down hover:bg-down" : "cursor-not-allowed bg-fg-subtle opacity-50",
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
        "flex h-7 w-7 shrink-0 items-center justify-center rounded-[10px] text-fg transition-colors hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-40",
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
        "flex shrink-0 items-center justify-between gap-3 border-t px-6 py-4",
        APP_MODAL_RULE_CLASS,
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
