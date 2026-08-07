import type { ComponentPropsWithoutRef, ReactNode } from "react";

import { cn } from "@/lib/utils";

/** Animated shimmer label (HeroUI TextShimmer–style). Color via `currentColor` / text utilities. */
export function TextShimmer({
  children,
  className,
  ...props
}: {
  children: ReactNode;
  className?: string;
} & Omit<ComponentPropsWithoutRef<"span">, "children" | "className">) {
  return (
    <span className={cn("text-shimmer", className)} {...props}>
      {children}
    </span>
  );
}
