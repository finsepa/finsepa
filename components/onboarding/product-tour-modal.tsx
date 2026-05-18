"use client";

import { useCallback, useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  preloadProductTourImages,
  PRODUCT_TOUR_PREVIEW_NATIVE_HEIGHT,
  PRODUCT_TOUR_PREVIEW_NATIVE_WIDTH,
  PRODUCT_TOUR_STEP_COUNT,
  PRODUCT_TOUR_STEPS,
  type ProductTourStep,
} from "@/lib/onboarding/product-tour-steps";

/** Visible crop window (~30% taller than 340px base; image scale unchanged). */
const TOUR_PREVIEW_HEIGHT_PX = 442;

/** Image render width — smaller = more UI visible inside the fixed frame. */
const TOUR_MOCKUP_WIDTH_PX = 900;

const TOUR_FRAME_RADIUS = "1rem"; // rounded-2xl on left corners only

function tourPreviewDisplaySize(step: ProductTourStep): { width: number; height: number } {
  const nativeW = step.previewNativeWidth ?? PRODUCT_TOUR_PREVIEW_NATIVE_WIDTH;
  const nativeH = step.previewNativeHeight ?? PRODUCT_TOUR_PREVIEW_NATIVE_HEIGHT;
  return {
    width: TOUR_MOCKUP_WIDTH_PX,
    height: Math.round((TOUR_MOCKUP_WIDTH_PX * nativeH) / nativeW),
  };
}

function usePreloadProductTourImages(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    preloadProductTourImages();
  }, [enabled]);
}

function TourMockupViewport({ activeIndex }: { activeIndex: number }) {
  return (
    <div
      className="relative w-full shrink-0 overflow-hidden bg-white"
      style={{ height: TOUR_PREVIEW_HEIGHT_PX }}
    >
      <div
        className="relative h-full overflow-hidden border border-r-0 border-[#E4E4E7] bg-white"
        style={{
          borderTopLeftRadius: TOUR_FRAME_RADIUS,
          borderBottomLeftRadius: TOUR_FRAME_RADIUS,
          borderTopRightRadius: 0,
          borderBottomRightRadius: 0,
          boxShadow: "-6px 16px 20px rgba(10, 10, 10, 0.07)",
        }}
      >
        {PRODUCT_TOUR_STEPS.map((step, i) => {
          const { width: imgW, height: imgH } = tourPreviewDisplaySize(step);
          return (
            <div
              key={step.id}
              className={cn(
                "absolute inset-0 bg-white transition-opacity duration-150 ease-out",
                i === activeIndex ? "z-10 opacity-100" : "pointer-events-none z-0 opacity-0",
              )}
              aria-hidden={i !== activeIndex}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- stacked + preloaded static PNGs for instant step changes */}
              <img
                src={step.previewSrc}
                alt=""
                width={imgW}
                height={imgH}
                className="absolute left-0 top-0 block max-w-none select-none"
                decoding="async"
                draggable={false}
              />
            </div>
          );
        })}
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

  usePreloadProductTourImages(open);

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
          className="absolute right-5 top-5 z-20 inline-flex h-9 w-9 items-center justify-center rounded-[10px] border border-transparent text-[#09090B] transition-colors hover:bg-[#F4F4F5]"
          aria-label="Close"
        >
          <X className="h-5 w-5" aria-hidden />
        </button>

        <header className="shrink-0 px-8 pb-0 pt-8 pr-16">
          <div className="flex max-w-[400px] flex-col gap-3">
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

        {/* Left-aligned mockup; clips on the right and bottom like Figma */}
        <div className="min-h-0 shrink-0 overflow-hidden bg-white py-6 pl-8 pr-0">
          <TourMockupViewport activeIndex={stepIndex} />
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

            <div
              className="flex items-center justify-center gap-2"
              aria-label={`Step ${stepIndex + 1} of ${PRODUCT_TOUR_STEP_COUNT}`}
            >
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
