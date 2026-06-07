"use client";

import { type ComponentPropsWithoutRef, useEffect, useRef } from "react";

import { attachIosHapticOverlay, canUseVibrationApi, isAppleMobileDevice } from "@/lib/haptic";

type HapticButtonProps = ComponentPropsWithoutRef<"button">;

/**
 * Button that triggers native haptics on mobile.
 * iOS 26.5+: invisible switch overlay (user must tap the switch directly).
 * Android: Vibration API on click.
 */
export function HapticButton({ ...props }: HapticButtonProps) {
  const ref = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const host = ref.current;
    if (!host) return;

    if (canUseVibrationApi()) {
      const onClick = () => navigator.vibrate(50);
      host.addEventListener("click", onClick);
      return () => host.removeEventListener("click", onClick);
    }

    if (isAppleMobileDevice()) {
      return attachIosHapticOverlay(host);
    }
  }, []);

  return <button ref={ref} type="button" {...props} />;
}
