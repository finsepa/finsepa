import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

import { AuthBrandMark } from "./auth-brand-mark";

export function AuthCenteredLayout({
  title,
  subtitle,
  children,
  preCard,
  compact = false,
}: {
  title: string;
  subtitle: ReactNode;
  children: ReactNode;
  /** Rendered above the white card (e.g. login success). */
  preCard?: ReactNode;
  /** Tighter card and typography (e.g. auth callback / short states). */
  compact?: boolean;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F7F7F7] p-4">
      <div className={cn("flex w-full flex-col gap-3", compact ? "max-w-[360px]" : "max-w-[420px]")}>
        {preCard}
        <div
          className={cn(
            "rounded-[12px] bg-white shadow-[0_2px_10px_rgba(0,0,0,0.04)]",
            compact ? "p-6" : "p-8",
          )}
        >
          <div className="flex justify-center">
            <AuthBrandMark className="h-7 w-7" />
          </div>

          <div className={cn("text-center", compact ? "mt-4" : "mt-6")}>
            <h1 className="text-[26px] font-semibold tracking-tight text-[#09090B]">{title}</h1>
            <div className="mt-2 text-sm leading-6 text-[#71717A]">{subtitle}</div>
          </div>

          <div className={cn(compact ? "mt-4" : "mt-6")}>{children}</div>
        </div>
      </div>
    </main>
  );
}

