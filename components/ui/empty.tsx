import type { ReactNode } from "react";

import { MOBILE_PANEL_CARD_CLASS } from "@/components/design-system/card-surface-styles";
import { cn } from "@/lib/utils";

/** Default copy when {@link EmptyTitle} / {@link EmptyDescription} omit children. */
export const EMPTY_DEFAULT_TITLE = "Nothing found";
export const EMPTY_DEFAULT_DESCRIPTION = "Nothing found yet.";

type EmptyVariant = "card" | "plain";

export function Empty({
  className,
  children,
  variant = "plain",
}: {
  className?: string;
  children: ReactNode;
  /** `card`: bordered panel (lists, main panels). `plain`: inset block (charts, tight layouts). */
  variant?: EmptyVariant;
}) {
  return (
    <div
      role="status"
      className={cn(
        "flex w-full flex-col items-center justify-center text-center",
        variant === "card" &&
          cn(
            "min-h-[min(40vh,360px)] px-6 py-16",
            MOBILE_PANEL_CARD_CLASS,
          ),
        variant === "plain" && "px-6 py-8",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function EmptyHeader({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={cn("flex max-w-md flex-col items-center gap-2 [&>p+p]:-mt-1", className)}>{children}</div>
  );
}

export function EmptyMedia({
  variant = "default",
  className,
  children,
}: {
  variant?: "default" | "icon";
  className?: string;
  children: ReactNode;
}) {
  if (variant === "icon") {
    return (
      <div
        className={cn(
          "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#F4F4F5] text-[#71717A]",
          className,
        )}
      >
        {children}
      </div>
    );
  }
  return <div className={cn("shrink-0", className)}>{children}</div>;
}

/** Shared empty-state typography (16/24 title, 14/20 description). */
export const emptyTitleClassName = "text-[16px] font-semibold leading-[24px] text-[#0F0F0F]";
export const emptyDescriptionClassName = "text-[14px] font-normal leading-[20px] text-[#71717A]";

export function EmptyTitle({ className, children }: { className?: string; children?: ReactNode }) {
  return (
    <p className={cn(emptyTitleClassName, className)}>
      {children ?? EMPTY_DEFAULT_TITLE}
    </p>
  );
}

export function EmptyDescription({ className, children }: { className?: string; children?: ReactNode }) {
  return (
    <p className={cn(emptyDescriptionClassName, className)}>
      {children ?? EMPTY_DEFAULT_DESCRIPTION}
    </p>
  );
}

/** Optional row for actions later; no default padding beyond top spacing. */
export function EmptyContent({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("mt-2 flex flex-col items-center gap-2", className)}>{children}</div>;
}
