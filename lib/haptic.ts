const TOUCH_MEDIA_QUERY = "(hover: none), (pointer: coarse)";

function isTouchDeviceNow(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }
  return window.matchMedia(TOUCH_MEDIA_QUERY).matches;
}

function isAppleMobileDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/i.test(ua)) return true;
  // iPadOS 13+ can report a desktop UA.
  return navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
}

function canUseVibrationApi(): boolean {
  return (
    typeof navigator !== "undefined" &&
    typeof navigator.vibrate === "function" &&
    !isAppleMobileDevice() &&
    typeof window !== "undefined" &&
    window.isSecureContext
  );
}

let iosSwitchRig: HTMLLabelElement | null = null;

function getIosSwitchRig(): HTMLLabelElement {
  if (iosSwitchRig?.isConnected) return iosSwitchRig;

  const label = document.createElement("label");
  label.setAttribute("aria-hidden", "true");
  // Keep the switch in the layout tree; display:none can block WebKit haptics.
  label.style.cssText =
    "position:fixed;left:-9999px;top:-9999px;width:1px;height:1px;opacity:0;overflow:hidden;pointer-events:none;";

  const input = document.createElement("input");
  input.type = "checkbox";
  input.setAttribute("switch", "");
  label.appendChild(input);

  document.body.appendChild(label);
  iosSwitchRig = label;
  return label;
}

function triggerIosSwitchHaptic(): void {
  getIosSwitchRig().click();
}

/** Whether this device can trigger web haptics (touch + iOS switch or Vibration API). */
export function supportsHaptics(): boolean {
  return isTouchDeviceNow() && (canUseVibrationApi() || isAppleMobileDevice());
}

/**
 * Trigger haptic feedback on mobile devices.
 * Android: Vibration API (HTTPS required). iOS 17.4+ Safari: hidden switch toggle.
 *
 * Call synchronously from a user gesture (pointer/touch/click handler).
 *
 * @see https://chanhdai.com/components/haptic-feedback
 */
export function haptic(pattern: number | number[] = 50) {
  try {
    if (!isTouchDeviceNow()) return;

    if (canUseVibrationApi()) {
      navigator.vibrate(pattern);
      return;
    }

    if (isAppleMobileDevice()) {
      triggerIosSwitchHaptic();
    }
  } catch {
    // Haptics are best-effort; ignore unsupported environments.
  }
}
