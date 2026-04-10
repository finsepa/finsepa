import type { ReactNode } from "react";

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
          "min-h-[min(40vh,360px)] rounded-[12px] border border-[#E4E4E7] bg-white px-6 py-16",
        variant === "plain" && "px-6 py-8",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function EmptyHeader({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("flex max-w-md flex-col items-center gap-2", className)}>{children}</div>;
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

export function EmptyTitle({ className, children }: { className?: string; children?: ReactNode }) {
  return (
    <p className={cn("text-lg font-semibold leading-7 text-[#09090B]", className)}>
      {children ?? EMPTY_DEFAULT_TITLE}
    </p>
  );
}

export function EmptyDescription({ className, children }: { className?: string; children?: ReactNode }) {
  return (
    <p className={cn("-mt-0.5 text-sm leading-5 text-[#71717A]", className)}>
      {children ?? EMPTY_DEFAULT_DESCRIPTION}
    </p>
  );
}

/** Optional row for actions later; no default padding beyond top spacing. */
export function EmptyContent({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("mt-2 flex flex-col items-center gap-2", className)}>{children}</div>;
}
