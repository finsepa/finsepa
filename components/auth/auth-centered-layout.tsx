import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

import { AuthBrandMark } from "./auth-brand-mark";

export function AuthCenteredLayout({
  title,
  subtitle,
  titleClassName,
  children,
  preCard,
  compact = false,
  footer,
}: {
  title: string;
  subtitle: ReactNode;
  /** Merged onto the title heading (e.g. alternate color on signup). */
  titleClassName?: string;
  children: ReactNode;
  /** Rendered above the white card (e.g. login success). */
  preCard?: ReactNode;
  /** Tighter card and typography (e.g. auth callback / short states). */
  compact?: boolean;
  /** Pinned to the bottom of the viewport (e.g. legal disclaimer). */
  footer?: ReactNode;
}) {
  const maxW = compact ? "max-w-[360px]" : "max-w-[420px]";

  return (
    <main className="flex min-h-[100dvh] flex-col bg-[#F7F7F7]">
      <div className="flex flex-1 flex-col items-center justify-center p-4">
        <div className={cn("flex w-full flex-col gap-3", maxW)}>
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
              <h1
                className={cn(
                  "text-[26px] font-semibold tracking-tight text-[#09090B]",
                  titleClassName,
                )}
              >
                {title}
              </h1>
              <div className="mt-2 text-sm leading-6 text-[#71717A]">{subtitle}</div>
            </div>

            <div className={cn(compact ? "mt-4" : "mt-6")}>{children}</div>
          </div>
        </div>
      </div>
      {footer != null ? (
        <div className="shrink-0 px-4 pb-8 pt-2">
          <div className={cn("mx-auto w-full text-center", maxW)}>{footer}</div>
        </div>
      ) : null}
    </main>
  );
}

