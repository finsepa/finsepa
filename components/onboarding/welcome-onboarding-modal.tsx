"use client";

import { useCallback, useEffect, useId } from "react";
import { createPortal } from "react-dom";

import { AuthBrandMark } from "@/components/auth/auth-brand-mark";

export function WelcomeOnboardingModal({
  open,
  onContinue,
}: {
  open: boolean;
  onContinue: () => void;
}) {
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
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prev;
    };
  }, [open, onKeyDown]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[280] flex items-center justify-center bg-black/40 p-4">
      <button
        type="button"
        aria-label="Close welcome dialog"
        className="absolute inset-0"
        onClick={onContinue}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative w-full max-w-[800px] overflow-hidden rounded-xl bg-white shadow-[0px_10px_16px_-3px_rgba(10,10,10,0.1),0px_4px_6px_0px_rgba(10,10,10,0.04)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-col items-center px-8 py-16">
          <div className="flex items-center justify-center rounded-[20px] bg-[#09090B] p-3">
            <AuthBrandMark size={49} className="h-[49px] w-[49px]" />
          </div>

          <div className="mt-4 flex max-w-[400px] flex-col items-center gap-2 text-center">
            <h2
              id={titleId}
              className="text-[30px] font-bold leading-9 tracking-tight text-[#09090B]"
            >
              Welcome to Finsepa
            </h2>
            <p className="text-sm leading-5 text-[#71717A]">
              Research, track, and analyze your investments in one place
            </p>
          </div>

          <button
            type="button"
            onClick={onContinue}
            className="mt-4 inline-flex h-9 items-center justify-center rounded-[10px] bg-[#09090B] px-4 text-sm font-medium leading-5 text-white shadow-[0px_1px_2px_0px_rgba(10,10,10,0.06)] transition-colors hover:bg-[#27272A]"
          >
            Continue
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
