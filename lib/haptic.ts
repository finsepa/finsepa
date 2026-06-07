const TOUCH_MEDIA_QUERY = "(hover: none), (pointer: coarse)";
const HAPTIC_OVERLAY_ATTR = "data-haptic-overlay";

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

function triggerIosSwitchProgrammaticHaptic(): void {
  const label = document.createElement("label");
  label.setAttribute("aria-hidden", "true");
  label.style.cssText =
    "position:fixed;left:-9999px;top:-9999px;width:1px;height:1px;opacity:0;overflow:hidden;pointer-events:none;";

  const input = document.createElement("input");
  input.type = "checkbox";
  input.setAttribute("switch", "");
  label.appendChild(input);

  document.body.appendChild(label);
  try {
    label.click();
  } finally {
    label.remove();
  }
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
    "position:absolute;inset:0;width:100%;height:100%;margin:0;padding:0;border:0;" +
    "-webkit-appearance:switch;appearance:auto;opacity:0;cursor:inherit;pointer-events:auto;";

  const onOverlayClick = (event: Event) => {
    event.stopPropagation();
    host.focus({ preventScroll: true });
    host.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
  };

  overlay.addEventListener("click", onOverlayClick);
  host.appendChild(overlay);

  return () => {
    overlay.removeEventListener("click", onOverlayClick);
    overlay.remove();
  };
}

/** Whether this device can trigger web haptics (touch + iOS switch or Vibration API). */
export function supportsHaptics(): boolean {
  return isTouchDeviceNow() && (canUseVibrationApi() || isAppleMobileDevice());
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
