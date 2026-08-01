"use client";

import type { ComponentProps, CSSProperties } from "react";
import { useTheme } from "next-themes";
import { dropdownMenuElevationImportantClass } from "@/components/design-system/dropdown-menu-styles";
import { CircleCheck } from "@/lib/icons";
import { cn } from "@/lib/utils";
import { Toaster as Sonner } from "sonner";

import "sonner/dist/styles.css";

type ToasterProps = ComponentProps<typeof Sonner>;

/** Matches positive P/L green (`text-up`) used across portfolio and markets tables. */
const successToastIcon = (
  <CircleCheck className="size-4 shrink-0 text-up" strokeWidth={2} aria-hidden />
);

/** Dropdown-matched surface tokens for Sonner CSS variables. */
const toastSurfaceStyle = {
  "--border-radius": "16px",
  "--normal-bg": "var(--fs-surface)",
  "--normal-bg-hover": "var(--fs-surface-muted)",
  "--normal-border": "var(--fs-stroke)",
  "--normal-border-hover": "var(--fs-stroke)",
  "--normal-text": "var(--fs-fg)",
  "--toast-close-button-start": "unset",
  "--toast-close-button-end": "12px",
  "--toast-close-button-transform": "none",
} as CSSProperties;

/** Sonner — see https://ui.shadcn.com/docs/components/radix/sonner */
export function Toaster({ ...props }: ToasterProps) {
  const { resolvedTheme } = useTheme();

  return (
    <Sonner
      theme={resolvedTheme === "dark" ? "dark" : "light"}
      className={cn("toaster group", "z-[300]")}
      style={toastSurfaceStyle}
      icons={{ success: successToastIcon }}
      toastOptions={{
        classNames: {
          toast: cn(
            "group toast",
            "relative !items-start justify-start text-left",
            "rounded-2xl !border !border-stroke !bg-surface !text-fg",
            "px-5 py-3.5 pr-11",
            dropdownMenuElevationImportantClass,
          ),
          content: "items-start text-left",
          title: "text-left text-sm font-semibold text-fg",
          description: "text-left text-sm text-fg-muted",
          icon: "!mx-0 !mr-2 !mt-0.5 !self-start",
          closeButton:
            "!left-auto !right-3 !top-3 !translate-y-0 !border-stroke !bg-surface !text-fg-muted opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 hover:!border-stroke hover:!bg-surface-muted hover:!text-fg",
          actionButton:
            "!rounded-lg !bg-fg !px-3 !py-1.5 !text-sm !font-medium !text-surface",
          cancelButton: "!rounded-lg !text-sm !text-fg-muted",
        },
      }}
      {...props}
    />
  );
}
