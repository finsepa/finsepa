const TOUCH_MEDIA_QUERY = "(hover: none), (pointer: coarse)";
export const HAPTIC_OVERLAY_ATTR = "data-haptic-overlay";

export function isTouchDeviceNow(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }
  return window.matchMedia(TOUCH_MEDIA_QUERY).matches;
}

export function isAppleMobileDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/i.test(ua)) return true;
  // iPadOS 13+ can report a desktop UA.
  return navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
}

export function canUseVibrationApi(): boolean {
  return (
    typeof navigator !== "undefined" &&
    typeof navigator.vibrate === "function" &&
    !isAppleMobileDevice() &&
    typeof window !== "undefined" &&
    window.isSecureContext
  );
}

let iosGestureSwitch: HTMLInputElement | null = null;

function ensureIosGestureSwitch(): HTMLInputElement {
  if (!iosGestureSwitch) {
    iosGestureSwitch = document.createElement("input");
    iosGestureSwitch.type = "checkbox";
    iosGestureSwitch.setAttribute("switch", "");
    iosGestureSwitch.setAttribute("aria-hidden", "true");
    iosGestureSwitch.style.cssText =
      "position:fixed;left:0;top:0;width:1px;height:1px;margin:0;padding:0;border:0;opacity:0.001;";
    document.body.appendChild(iosGestureSwitch);
  }
  return iosGestureSwitch;
}

/** Toggle the iOS switch during an active user gesture (e.g. chart scrub). */
export function triggerIosHapticInUserGesture(): void {
  if (!isAppleMobileDevice() || !isTouchDeviceNow()) return;
  ensureIosGestureSwitch().click();
}

/** Pulse the pass-through overlay on `host`, if present (chart scrub). */
export function triggerHostHapticOverlayClick(host: HTMLElement): void {
  const overlay = host.querySelector(`[${HAPTIC_OVERLAY_ATTR}]`);
  if (overlay instanceof HTMLInputElement) {
    overlay.click();
    return;
  }
  triggerIosHapticInUserGesture();
}

function triggerIosSwitchProgrammaticHaptic(): void {
  triggerIosHapticInUserGesture();
}

function clonePointerEvent(event: PointerEvent): PointerEvent {
  return new PointerEvent(event.type, {
    bubbles: true,
    cancelable: true,
    composed: true,
    clientX: event.clientX,
    clientY: event.clientY,
    screenX: event.screenX,
    screenY: event.screenY,
    pointerId: event.pointerId,
    pointerType: event.pointerType,
    pressure: event.pressure,
    buttons: event.buttons,
    button: event.button,
    width: event.width,
    height: event.height,
    isPrimary: event.isPrimary,
  });
}

function forwardPointerThroughOverlay(overlay: HTMLElement, event: PointerEvent): void {
  if (event.pointerType === "mouse") return;
  overlay.style.pointerEvents = "none";
  const under = document.elementFromPoint(event.clientX, event.clientY);
  overlay.style.pointerEvents = "auto";
  if (!under || under === overlay) return;
  under.dispatchEvent(clonePointerEvent(event));
}

/**
 * iOS switch overlay that forwards pointer events to the chart canvas underneath.
 * User finger toggles the switch (haptic); chart still receives scrub gestures.
 */
export function attachPassThroughIosHapticOverlay(host: HTMLElement): () => void {
  if (host.querySelector(`[${HAPTIC_OVERLAY_ATTR}]`)) return () => {};

  const position = getComputedStyle(host).position;
  if (position !== "absolute" && position !== "relative" && position !== "fixed" && position !== "sticky") {
    host.style.position = "relative";
  }

  const overlay = document.createElement("input");
  overlay.type = "checkbox";
  overlay.setAttribute("switch", "");
  overlay.setAttribute(HAPTIC_OVERLAY_ATTR, "");
  overlay.setAttribute("aria-hidden", "true");
  overlay.tabIndex = -1;
  overlay.style.cssText =
    "position:absolute;inset:0;width:100%;height:100%;margin:0;padding:0;border:0;outline:none;" +
    "-webkit-appearance:switch;appearance:auto;opacity:0;cursor:inherit;pointer-events:auto;z-index:2;";

  const forward = (event: PointerEvent) => {
    forwardPointerThroughOverlay(overlay, event);
  };

  const onPointerDown = (event: PointerEvent) => {
    if (event.pointerType !== "mouse") {
      try {
        overlay.setPointerCapture(event.pointerId);
      } catch {
        // Best-effort — forwarding still works without capture.
      }
    }
    forward(event);
  };

  const onPointerUp = (event: PointerEvent) => {
    if (overlay.hasPointerCapture(event.pointerId)) {
      try {
        overlay.releasePointerCapture(event.pointerId);
      } catch {
        // Ignore release failures.
      }
    }
    forward(event);
  };

  const onOverlayFocus = () => {
    overlay.blur();
  };

  overlay.addEventListener("pointerdown", onPointerDown);
  overlay.addEventListener("pointermove", forward);
  overlay.addEventListener("pointerup", onPointerUp);
  overlay.addEventListener("pointercancel", onPointerUp);
  overlay.addEventListener("focus", onOverlayFocus);

  host.appendChild(overlay);

  return () => {
    overlay.removeEventListener("pointerdown", onPointerDown);
    overlay.removeEventListener("pointermove", forward);
    overlay.removeEventListener("pointerup", onPointerUp);
    overlay.removeEventListener("pointercancel", onPointerUp);
    overlay.removeEventListener("focus", onOverlayFocus);
    overlay.remove();
  };
}

/**
 * Attach an invisible iOS switch overlay so the user's finger toggles it directly.
 * Required on iOS 26.5+ where programmatic `.click()` no longer triggers haptics.
 *
 * @see https://github.com/tijnjh/ios-haptics — patched in iOS 26.5
 */
export function attachIosHapticOverlay(host: HTMLElement): () => void {
  if (host.querySelector(`[${HAPTIC_OVERLAY_ATTR}]`)) return () => {};

  const position = getComputedStyle(host).position;
  if (position !== "absolute" && position !== "relative" && position !== "fixed" && position !== "sticky") {
    host.style.position = "relative";
  }

  const overlay = document.createElement("input");
  overlay.type = "checkbox";
  overlay.setAttribute("switch", "");
  overlay.setAttribute(HAPTIC_OVERLAY_ATTR, "");
  overlay.setAttribute("aria-hidden", "true");
  overlay.tabIndex = -1;
  overlay.style.cssText =
    "position:absolute;inset:0;width:100%;height:100%;margin:0;padding:0;border:0;outline:none;" +
    "-webkit-appearance:switch;appearance:auto;opacity:0;cursor:inherit;pointer-events:auto;";

  const onOverlayFocus = () => {
    overlay.blur();
  };

  const onOverlayClick = (event: Event) => {
    event.stopPropagation();
    host.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    overlay.blur();
    if (host instanceof HTMLElement) {
      host.blur();
    }
  };

  overlay.addEventListener("focus", onOverlayFocus);
  overlay.addEventListener("click", onOverlayClick);
  host.appendChild(overlay);

  return () => {
    overlay.removeEventListener("focus", onOverlayFocus);
    overlay.removeEventListener("click", onOverlayClick);
    overlay.remove();
  };
}

/** Whether this device can trigger web haptics (touch + iOS switch or Vibration API). */
export function supportsHaptics(): boolean {
  return isTouchDeviceNow() && (canUseVibrationApi() || isAppleMobileDevice());
}

/** Light tick for mobile chart tap / interval scrub — no-op on desktop. */
export function triggerMobileChartHaptic(): void {
  if (!isTouchDeviceNow()) return;
  if (canUseVibrationApi()) {
    navigator.vibrate(35);
    return;
  }
  if (isAppleMobileDevice()) {
    triggerIosHapticInUserGesture();
  }
}

/**
 * Best-effort imperative haptic. Works on Android; on iOS only before 26.5.
 * For buttons on iOS 26.5+, use `HapticButton` instead.
 */
export function haptic(pattern: number | number[] = 50) {
  try {
    if (!isTouchDeviceNow()) return;

    if (canUseVibrationApi()) {
      navigator.vibrate(pattern);
      return;
    }

    if (isAppleMobileDevice()) {
      triggerIosSwitchProgrammaticHaptic();
    }
  } catch {
    // Haptics are best-effort; ignore unsupported environments.
  }
}
