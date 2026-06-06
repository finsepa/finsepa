"use client";

import { useCallback, useEffect, useId, useState } from "react";

import { AppModalOverlay } from "@/components/ui/app-modal-overlay";
import {
  AppModalCloseButton,
  AppModalFooter,
  AppModalShell,
  appModalCancelButtonClass,
  appModalPrimaryButtonClass,
} from "@/components/ui/app-modal-shell";
import { cn } from "@/lib/utils";
import {
  preloadProductTourImages,
  PRODUCT_TOUR_PREVIEW_NATIVE_HEIGHT,
  PRODUCT_TOUR_PREVIEW_NATIVE_WIDTH,
  PRODUCT_TOUR_STEP_COUNT,
  PRODUCT_TOUR_STEPS,
  type ProductTourStep,
} from "@/lib/onboarding/product-tour-steps";

import { useClientMounted } from "./use-client-mounted";

/** Visible crop window — clips the mockup on the right/bottom. */
const TOUR_PREVIEW_HEIGHT_DESKTOP_PX = 442;
const TOUR_PREVIEW_HEIGHT_MOBILE_PX = 220;

/** Image render width — smaller = more UI visible inside the fixed frame. */
const TOUR_MOCKUP_WIDTH_DESKTOP_PX = 900;
const TOUR_MOCKUP_WIDTH_MOBILE_PX = 437;

const TOUR_FRAME_RADIUS = "1rem"; // rounded-2xl on left corners only

function tourPreviewDisplaySize(
  step: ProductTourStep,
  mockupWidthPx: number,
): { width: number; height: number } {
  const nativeW = step.previewNativeWidth ?? PRODUCT_TOUR_PREVIEW_NATIVE_WIDTH;
  const nativeH = step.previewNativeHeight ?? PRODUCT_TOUR_PREVIEW_NATIVE_HEIGHT;
  return {
    width: mockupWidthPx,
    height: Math.round((mockupWidthPx * nativeH) / nativeW),
  };
}

function usePreloadProductTourImages(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    preloadProductTourImages();
  }, [enabled]);
}

function TourMockupViewport({
  activeIndex,
  previewHeightPx,
  mockupWidthPx,
}: {
  activeIndex: number;
  previewHeightPx: number;
  mockupWidthPx: number;
}) {
  return (
    <div
      className="relative w-full shrink-0 overflow-hidden bg-white"
      style={{ height: previewHeightPx }}
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
          const { width: imgW, height: imgH } = tourPreviewDisplaySize(step, mockupWidthPx);
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
                className="absolute block max-w-none select-none"
                style={{
                  left: step.previewOffsetX ?? 0,
                  top: step.previewOffsetY ?? 0,
                }}
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
  const mounted = useClientMounted();
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
    return () => {
      document.removeEventListener("keydown", onKeyDown);
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

  if (!mounted || !open) return null;

  return (
    <AppModalOverlay open={open} onClose={onDismiss} zIndex={281}>
      <AppModalShell
        titleId={titleId}
        maxWidthClass="w-full max-w-[800px]"
        maxHeightClass="max-h-[min(90vh,800px)]"
        bodyScroll={false}
        header={
          <div className="flex w-full items-start justify-between gap-3">
            <div className="flex min-w-0 max-w-[400px] flex-col gap-3">
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
            <AppModalCloseButton onClick={onDismiss} />
          </div>
        }
        headerClassName="px-5 pb-0 pt-6 md:px-8 md:pt-8"
        cardClassName="overflow-hidden"
        bodyClassName="min-h-0 flex-1 overflow-hidden bg-white py-3 pl-4 pr-0 md:py-6 md:pl-8"
        footer={
          <AppModalFooter className="border-transparent">
            <div className="flex w-full items-center justify-between gap-4">
              <div className="w-[120px]">
                {!isFirst ? (
                  <button type="button" onClick={goBack} className={appModalCancelButtonClass}>
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
                <button type="button" onClick={goNext} className={appModalPrimaryButtonClass(true)}>
                  {isLast ? "Get Started" : "Next"}
                </button>
              </div>
            </div>
          </AppModalFooter>
        }
      >
        <div className="md:hidden">
          <TourMockupViewport
            activeIndex={stepIndex}
            previewHeightPx={TOUR_PREVIEW_HEIGHT_MOBILE_PX}
            mockupWidthPx={TOUR_MOCKUP_WIDTH_MOBILE_PX}
          />
        </div>
        <div className="hidden md:block">
          <TourMockupViewport
            activeIndex={stepIndex}
            previewHeightPx={TOUR_PREVIEW_HEIGHT_DESKTOP_PX}
            mockupWidthPx={TOUR_MOCKUP_WIDTH_DESKTOP_PX}
          />
        </div>
      </AppModalShell>
    </AppModalOverlay>
  );
}
