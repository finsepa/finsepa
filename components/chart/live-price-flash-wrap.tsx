"use client";

import type { ReactNode } from "react";

import type { LivePriceFlashDirection } from "@/lib/chart/use-live-price-flash";
import { cn } from "@/lib/utils";

/**
 * Soft up/down flash behind a live price. The highlight is an absolute overlay so the
 * number / layout never remounts or shifts when the flash starts or ends.
 */
export function LivePriceFlashWrap({
  flash,
  animationKey,
  className,
  children,
}: {
  flash: LivePriceFlashDirection | null;
  animationKey: number;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        // Reserve flash inset always — avoids layout jump when highlight appears.
        "relative inline-flex max-w-full items-baseline rounded-[3px] px-0.5 -mx-0.5",
        className,
      )}
    >
      {flash != null ? (
        <span
          key={animationKey}
          aria-hidden
          className={cn(
            "pointer-events-none absolute inset-0 rounded-[3px]",
            flash === "up" && "animate-live-price-flash-up",
            flash === "down" && "animate-live-price-flash-down",
          )}
        />
      ) : null}
      <span className="relative inline-flex max-w-full min-w-0 items-baseline">{children}</span>
    </span>
  );
}
