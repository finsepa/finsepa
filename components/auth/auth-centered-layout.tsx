import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

import { AuthBrandMark } from "./auth-brand-mark";
import { AuthSplitAsidePanelLazy } from "./auth-split-aside-lazy";
import { AuthSplitLayout } from "./auth-split-layout";

function AuthHeaderBlock({
  title,
  subtitle,
  titleClassName,
}: {
  title: string;
  subtitle: ReactNode;
  titleClassName?: string;
}) {
  return (
    <div className="flex flex-col items-center gap-4">
      <AuthBrandMark />
      <div className="flex w-full flex-col gap-2 text-center">
        <h1
          className={cn(
            "text-[26px] font-semibold leading-8 tracking-tight text-[#0F0F0F]",
            titleClassName,
          )}
        >
          {title}
        </h1>
        <div className="text-sm leading-5 text-[#71717A]">{subtitle}</div>
      </div>
    </div>
  );
}

export function AuthCenteredLayout({
  title,
  subtitle,
  titleClassName,
  children,
  preCard,
  compact = false,
  belowCard,
  footer,
  split = false,
}: {
  title: string;
  subtitle: ReactNode;
  titleClassName?: string;
  children: ReactNode;
  preCard?: ReactNode;
  compact?: boolean;
  belowCard?: ReactNode;
  footer?: ReactNode;
  split?: boolean;
}) {
  const formWidthClass = split ? "max-w-[384px]" : compact ? "max-w-[360px]" : "max-w-[420px]";

  const formBlock = (
    <div className={cn("flex w-full flex-col gap-4", formWidthClass)}>
      {preCard}
      <AuthHeaderBlock title={title} subtitle={subtitle} titleClassName={titleClassName} />
      <div className={compact ? "space-y-4" : "space-y-6"}>{children}</div>
    </div>
  );

  if (split) {
    return (
      <AuthSplitLayout
        form={formBlock}
        aside={<AuthSplitAsidePanelLazy />}
        footer={footer ?? undefined}
      />
    );
  }

  return (
    <>
      <div className="fixed inset-0 -z-10 bg-[#F7F7F7] md:hidden" aria-hidden />
      <main className="flex min-h-[100dvh] flex-col bg-[#F7F7F7]">
        <div className="flex flex-1 flex-col items-center justify-center p-4">
          <div className={cn("flex w-full flex-col gap-3", formWidthClass)}>
            {preCard}
            <div
              className={cn(
                "rounded-[12px] bg-white shadow-[0_2px_10px_rgba(0,0,0,0.04)]",
                compact ? "p-6" : "p-8",
              )}
            >
              <div className={compact ? "mb-4" : "mb-6"}>
                <AuthHeaderBlock title={title} subtitle={subtitle} titleClassName={titleClassName} />
              </div>
              <div className={compact ? "mt-4" : "mt-6"}>{children}</div>
            </div>
            {belowCard != null ? <div>{belowCard}</div> : null}
          </div>
        </div>
        {footer != null ? (
          <div className="shrink-0 px-4 pb-8 pt-2">
            <div className={cn("mx-auto w-full text-center", formWidthClass)}>{footer}</div>
          </div>
        ) : null}
      </main>
    </>
  );
}
