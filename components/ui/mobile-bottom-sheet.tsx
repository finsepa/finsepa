"use client";

import { useEffect, useId, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

import { AppModalOverlay } from "@/components/ui/app-modal-overlay";
import { cn } from "@/lib/utils";

export const MOBILE_BOTTOM_SHEET_ENTER_CLASS = "mobile-bottom-nav-sheet-enter";

export const MOBILE_BOTTOM_SHEET_PANEL_CLASS =
  "flex w-full max-h-[min(70vh,560px)] flex-col overflow-y-auto overscroll-contain bg-white shadow-[0px_10px_16px_-3px_rgba(10,10,10,0.10),0px_4px_6px_0px_rgba(10,10,10,0.04)]";

/** 8px horizontal + bottom inset on the overlay so the dimmed backdrop shows around the modal sheet. */
export const MOBILE_MODAL_SHEET_OVERLAY_BACKDROP_CLASS = "!bg-black/20 !backdrop-blur-none";

export const MOBILE_MODAL_SHEET_OVERLAY_INSET_CLASS =
  "!px-2 !pb-[calc(0.5rem+env(safe-area-inset-bottom,0px))]";

export const MOBILE_MODAL_SHEET_OVERLAY_CLASS = cn(
  "!pt-0",
  MOBILE_MODAL_SHEET_OVERLAY_BACKDROP_CLASS,
  MOBILE_MODAL_SHEET_OVERLAY_INSET_CLASS,
);

type MobileBottomSheetProps = {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  titleId?: string;
  children: ReactNode;
  zIndex?: number;
  className?: string;
  bodyClassName?: string;
  showDragHandle?: boolean;
};

/** Mobile modal sheet — dropdown/action surface with 8px inset and dimmed overlay. */
export function MobileBottomSheet({
  open,
  onClose,
  title,
  titleId: titleIdProp,
  children,
  zIndex = 250,
  className,
  bodyClassName,
  showDragHandle = false,
}: MobileBottomSheetProps) {
  const [mounted, setMounted] = useState(false);
  const autoTitleId = useId();
  const titleId = titleIdProp ?? (title ? autoTitleId : undefined);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || !mounted) return null;

  return createPortal(
    <AppModalOverlay
      open={open}
      onClose={onClose}
      align="bottom"
      zIndex={zIndex}
      shellEffect={false}
      className={MOBILE_MODAL_SHEET_OVERLAY_CLASS}
      closeOnBackdropClick
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={cn(
          MOBILE_BOTTOM_SHEET_ENTER_CLASS,
          MOBILE_BOTTOM_SHEET_PANEL_CLASS,
          "rounded-2xl",
          className,
        )}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {showDragHandle ? (
          <div className="flex shrink-0 justify-center px-4 pb-1 pt-2" aria-hidden>
            <div className="h-1 w-10 rounded-full bg-[#D9D9D9]" />
          </div>
        ) : null}
        {title ? (
          <h2
            id={titleId}
            className={cn(
              "shrink-0 px-4 text-center text-base font-semibold leading-6 text-[#0F0F0F]",
              showDragHandle ? "pb-2 pt-0" : "pb-2 pt-4",
            )}
          >
            {title}
          </h2>
        ) : null}
        <div className={bodyClassName}>{children}</div>
      </div>
    </AppModalOverlay>,
    document.body,
  );
}
