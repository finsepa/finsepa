"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

import { useModalStackRegister } from "@/components/ui/modal-stack-provider";
import { cn } from "@/lib/utils";

export const APP_PANEL_MODAL_ENTER_CLASS = "app-panel-modal-enter";

type AppPanelModalOverlayProps = {
  open: boolean;
  children: ReactNode;
  onClose?: () => void;
  zIndex?: number;
  closeOnBackdropClick?: boolean;
  /** Shrinks + rounds `#app-shell-root` behind the overlay (same as v1 modals). */
  shellEffect?: boolean;
  className?: string;
};

/**
 * Modal v2 — right-docked panel with dimmed backdrop (notifications, activity feeds, etc.).
 */
export function AppPanelModalOverlay({
  open,
  children,
  onClose,
  zIndex = 100,
  closeOnBackdropClick = true,
  shellEffect = true,
  className,
}: AppPanelModalOverlayProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useModalStackRegister(open, shellEffect);

  useEffect(() => {
    const close = onClose;
    if (!open || !close) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && close) close();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || !mounted) return null;

  return createPortal(
    <div
      className={cn(
        "fixed inset-0 flex justify-end bg-black/40 backdrop-blur-[2px]",
        className,
      )}
      style={{ zIndex }}
      role="presentation"
      onMouseDown={(e) => {
        if (!closeOnBackdropClick || !onClose) return;
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {children}
    </div>,
    document.body,
  );
}
