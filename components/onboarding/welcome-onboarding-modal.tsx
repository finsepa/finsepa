"use client";

import { useCallback, useEffect, useId } from "react";

import { AuthBrandMark } from "@/components/auth/auth-brand-mark";
import { AppModalOverlay } from "@/components/ui/app-modal-overlay";
import { AppModalShell } from "@/components/ui/app-modal-shell";

import { useClientMounted } from "./use-client-mounted";

export function WelcomeOnboardingModal({
  open,
  onContinue,
}: {
  open: boolean;
  onContinue: () => void;
}) {
  const mounted = useClientMounted();
  const titleId = useId();

  const onKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onContinue();
    },
    [onContinue],
  );

  useEffect(() => {
    if (!open) return;
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onKeyDown]);

  if (!mounted || !open) return null;

  return (
    <AppModalOverlay open={open} onClose={onContinue} zIndex={280}>
      <AppModalShell
        titleId={titleId}
        showClose={false}
        maxWidthClass="w-full max-w-[800px]"
        bodyClassName="px-8 py-16"
        bodyScroll={false}
      >
        <div className="flex flex-col items-center">
          <div className="flex items-center justify-center rounded-[20px] bg-fg p-3">
            <AuthBrandMark size={49} className="h-[49px] w-[49px]" />
          </div>

          <div className="mt-4 flex max-w-[400px] flex-col items-center gap-2 text-center">
            <h2
              id={titleId}
              className="text-[30px] font-bold leading-9 tracking-tight text-fg"
            >
              Welcome to Finsepa
            </h2>
            <p className="text-sm leading-5 text-fg-muted">
              Research, track, and analyze your investments in one place
            </p>
          </div>

          <button
            type="button"
            onClick={onContinue}
            className="mt-4 inline-flex h-9 items-center justify-center rounded-[10px] bg-fg px-4 text-sm font-medium leading-5 text-surface shadow-[0px_1px_2px_0px_rgba(var(--fs-shadow-rgb),var(--fs-shadow-a-06))] transition-colors hover:bg-fg"
          >
            Continue
          </button>
        </div>
      </AppModalShell>
    </AppModalOverlay>
  );
}
