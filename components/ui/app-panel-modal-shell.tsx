"use client";

import type { ReactNode } from "react";

import {
  APP_MODAL_SHELL_CARD_CLASS,
  APP_MODAL_SHELL_OUTER_CLASS,
  APP_MODAL_TITLE_CLASS,
  AppModalCloseButton,
} from "@/components/ui/app-modal-shell";
import { APP_PANEL_MODAL_ENTER_CLASS } from "@/components/ui/app-panel-modal-overlay";
import { cn } from "@/lib/utils";

/** Matches v1 {@link AppModalShell} width; docked on the right instead of centered. */
export const APP_PANEL_MODAL_WIDTH_CLASS =
  "w-full max-w-[min(calc(100vw-16px),400px)] sm:w-[400px]";

type AppPanelModalShellProps = {
  titleId?: string;
  title?: ReactNode;
  headerLeading?: ReactNode;
  onClose?: () => void;
  headerActions?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
  headerClassName?: string;
  bodyClassName?: string;
  cardClassName?: string;
  bodyScroll?: boolean;
};

/**
 * Modal v2 shell — same gray frame + white card as {@link AppModalShell}, docked on the right.
 */
export function AppPanelModalShell({
  titleId,
  title,
  headerLeading,
  onClose,
  headerActions,
  children,
  footer,
  className,
  headerClassName,
  bodyClassName,
  cardClassName,
  bodyScroll = true,
}: AppPanelModalShellProps) {
  return (
    <div
      className={cn(
        APP_PANEL_MODAL_ENTER_CLASS,
        APP_MODAL_SHELL_OUTER_CLASS,
        APP_PANEL_MODAL_WIDTH_CLASS,
        "mt-2 mb-2 mr-2 h-[calc(100dvh-16px)]",
        className,
      )}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="flex h-full min-h-0 w-full flex-col"
      >
        <div
          className={cn(
            "flex shrink-0 items-center justify-between gap-3 px-4 py-3",
            headerClassName,
          )}
        >
          <div className="flex min-w-0 flex-1 items-center gap-2">
            {headerLeading}
            {title != null ? (
              <h2 id={titleId} className={cn(APP_MODAL_TITLE_CLASS, "min-w-0 truncate")}>
                {title}
              </h2>
            ) : (
              <span className="min-w-0 flex-1" />
            )}
          </div>
          {headerActions || onClose ? (
            <div className="flex shrink-0 items-center gap-1">
              {headerActions}
              {headerActions && onClose ? (
                <span className="mx-0.5 h-4 w-px shrink-0 bg-[#E4E4E7]" aria-hidden />
              ) : null}
              {onClose ? <AppModalCloseButton onClick={onClose} /> : null}
            </div>
          ) : null}
        </div>

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
      </div>
    </div>
  );
}
