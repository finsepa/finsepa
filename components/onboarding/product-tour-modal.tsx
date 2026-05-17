"use client";

import { useCallback, useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import Image from "next/image";

import { cn } from "@/lib/utils";
import {
  PRODUCT_TOUR_STEP_COUNT,
  PRODUCT_TOUR_STEPS,
  type ProductTourStep,
} from "@/lib/onboarding/product-tour-steps";

function StepPreview({ step }: { step: ProductTourStep }) {
  const Icon = step.icon;

  if (step.previewSrc) {
    return (
      <div className="overflow-hidden rounded-[16px] border border-[rgba(228,228,231,0.5)] p-[2px] shadow-[0_20px_12px_rgba(10,10,10,0.1),0_8px_4px_rgba(10,10,10,0.04)]">
        <div className="overflow-hidden rounded-[14px] border-2 border-[#E4E4E7] bg-white">
          <div className="relative aspect-[982/653] w-full min-h-[280px] max-h-[min(52vh,520px)]">
            <Image
              src={step.previewSrc}
              alt=""
              fill
              className="object-cover object-top"
              sizes="(max-width: 800px) 100vw, 736px"
              priority
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[280px] max-h-[min(52vh,520px)] flex-col items-center justify-center rounded-[16px] border border-[#E4E4E7] bg-[#FAFAFA] px-8 py-12">
      <div className="flex h-16 w-16 items-center justify-center rounded-[20px] bg-white shadow-[0px_1px_2px_0px_rgba(10,10,10,0.06)] ring-1 ring-[#E4E4E7]">
        <Icon className="h-8 w-8 text-[#09090B]" aria-hidden />
      </div>
    </div>
  );
}

export function ProductTourModal({
  open,
  onFinish,
  onDismiss,
}: {
  open: boolean;
  /** Last step “Get Started” — show Pro promo. */
  onFinish: () => void;
  /** Close (X, backdrop, Escape) on any step — show Pro promo. */
  onDismiss: () => void;
}) {
  const titleId = useId();
  const [stepIndex, setStepIndex] = useState(0);

  const step = PRODUCT_TOUR_STEPS[stepIndex]!;
  const Icon = step.icon;
  const isFirst = stepIndex === 0;
  const isLast = stepIndex === PRODUCT_TOUR_STEP_COUNT - 1;

  useEffect(() => {
    if (open) setStepIndex(0);
  }, [open]);

  const onKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onDismiss();
    },
    [onDismiss],
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

  function goNext() {
    if (isLast) {
      onFinish();
      return;
    }
    setStepIndex((i) => i + 1);
  }

  function goBack() {
    if (!isFirst) setStepIndex((i) => i - 1);
  }

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[281] flex items-center justify-center bg-black/40 p-4">
      <button type="button" aria-label="Close product tour" className="absolute inset-0" onClick={onDismiss} />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative flex max-h-[min(90vh,800px)] w-full max-w-[800px] flex-col overflow-hidden rounded-xl bg-white shadow-[0px_10px_16px_-3px_rgba(10,10,10,0.1),0px_4px_6px_0px_rgba(10,10,10,0.04)]"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onDismiss}
          className="absolute right-5 top-5 z-10 inline-flex h-9 w-9 items-center justify-center rounded-[10px] border border-transparent text-[#09090B] transition-colors hover:bg-[#F4F4F5]"
          aria-label="Close"
        >
          <X className="h-5 w-5" aria-hidden />
        </button>

        <header className="shrink-0 px-8 pb-0 pt-8 pr-16">
          <div className="flex max-w-[520px] flex-col gap-3">
            <div className="flex items-center gap-2">
              <span className="relative flex h-5 w-5 shrink-0 items-center justify-center">
                <span className="absolute left-1.5 top-1 h-4 w-4 rounded-full bg-[#E4E4E7]" aria-hidden />
                <Icon className="relative h-5 w-5 text-[#09090B]" aria-hidden />
              </span>
              <p id={titleId} className="text-base font-semibold leading-6 text-[#09090B]">
                {step.title}
              </p>
            </div>
            <p className="text-base leading-6 text-[#52525B]">{step.description}</p>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-8 py-6">
          <StepPreview step={step} />
        </div>

        <footer className="shrink-0 border-t border-transparent px-5 py-5">
          <div className="flex items-center justify-between gap-4">
            <div className="w-[120px]">
              {!isFirst ? (
                <button
                  type="button"
                  onClick={goBack}
                  className="inline-flex h-9 items-center justify-center rounded-[10px] bg-[#F4F4F5] px-4 text-sm font-medium leading-5 text-[#09090B] transition-colors hover:bg-[#E4E4E7]"
                >
                  Back
                </button>
              ) : null}
            </div>

            <div className="flex items-center justify-center gap-2" aria-label={`Step ${stepIndex + 1} of ${PRODUCT_TOUR_STEP_COUNT}`}>
              {PRODUCT_TOUR_STEPS.map((s, i) => (
                <span
                  key={s.id}
                  className={cn(
                    "h-1.5 w-1.5 rounded-full transition-colors",
                    i === stepIndex ? "bg-[#09090B]" : "bg-[#E4E4E7]",
                  )}
                  aria-hidden
                />
              ))}
            </div>

            <div className="flex w-[120px] justify-end">
              <button
                type="button"
                onClick={goNext}
                className="inline-flex h-9 items-center justify-center rounded-[10px] bg-[#09090B] px-4 text-sm font-medium leading-5 text-white shadow-[0px_1px_2px_0px_rgba(10,10,10,0.06)] transition-colors hover:bg-[#27272A]"
              >
                {isLast ? "Get Started" : "Next"}
              </button>
            </div>
          </div>
        </footer>
      </div>
    </div>,
    document.body,
  );
}
