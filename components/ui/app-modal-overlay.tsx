"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

import { useModalStackRegister } from "@/components/ui/modal-stack-provider";
import { cn } from "@/lib/utils";

export const APP_MODAL_DIALOG_ENTER_CLASS = "app-modal-dialog-enter";

export type AppModalOverlayAlign = "center" | "top" | "bottom" | "fullscreen";

type AppModalOverlayProps = {
  open: boolean;
  children: ReactNode;
  onClose?: () => void;
  zIndex?: number;
  align?: AppModalOverlayAlign;
  closeOnBackdropClick?: boolean;
  /** Shrinks + rounds `#app-shell-root` behind the overlay (Figma modal chrome). */
  shellEffect?: boolean;
  className?: string;
  role?: "presentation" | "dialog";
};

const ALIGN_CLASS: Record<AppModalOverlayAlign, string> = {
  center: "flex items-center justify-center p-4",
  top: "flex items-start justify-center px-4 pt-[max(2vh,env(safe-area-inset-top,0px))] sm:pt-[10vh]",
  bottom: "flex items-end justify-center p-4",
  fullscreen: "flex flex-col",
};

export function AppModalOverlay({
  open,
  children,
  onClose,
  zIndex = 100,
  align = "center",
  closeOnBackdropClick = true,
  shellEffect = true,
  className,
  role = "presentation",
}: AppModalOverlayProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useModalStackRegister(open, shellEffect);

  if (!open || !mounted) return null;

  const isFullscreen = align === "fullscreen";

  return createPortal(
    <div
      className={cn(
        "fixed inset-0",
        ALIGN_CLASS[align],
        isFullscreen ? "bg-white" : "bg-black/40 backdrop-blur-[2px]",
        className,
      )}
      style={{ zIndex }}
      role={role}
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
