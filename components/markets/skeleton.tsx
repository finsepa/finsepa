"use client";

import type { CSSProperties, ReactNode } from "react";

function cls(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export function SkeletonBox({
  className,
  style,
}: {
  className: string;
  style?: CSSProperties;
}) {
  return <div className={cls("skeleton", className)} style={style} aria-hidden="true" />;
}

export function TextSkeleton({ wClass = "w-24", hClass = "h-3.5" }: { wClass?: string; hClass?: string }) {
  return <SkeletonBox className={cls(hClass, wClass)} />;
}

export function PillSkeleton({ wClass = "w-12" }: { wClass?: string }) {
  return <SkeletonBox className={cls("h-5 rounded-md", wClass)} />;
}

export function LogoSkeleton({ sizeClass = "h-8 w-8" }: { sizeClass?: string }) {
  return <SkeletonBox className={cls(sizeClass, "rounded-lg")} />;
}

export function SparklineSkeleton({ className = "h-10 w-full" }: { className?: string }) {
  return <SkeletonBox className={cls(className, "rounded-md")} />;
}

export function FadeIn({ show, children }: { show: boolean; children: ReactNode }) {
  return (
    <div className={cls("transition-opacity duration-200", show ? "opacity-100" : "opacity-0")}>
      {children}
    </div>
  );
}

