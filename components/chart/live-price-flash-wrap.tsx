"use client";

import type { ReactNode } from "react";

import type { LivePriceFlashDirection } from "@/lib/chart/use-live-price-flash";
import { cn } from "@/lib/utils";

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
  const active = flash != null;
  return (
    <span
      key={active ? animationKey : "idle"}
      className={cn(
        className,
        active && "rounded-[3px] px-0.5 -mx-0.5",
        active && flash === "up" && "animate-live-price-flash-up",
        active && flash === "down" && "animate-live-price-flash-down",
      )}
    >
      {children}
    </span>
  );
}
