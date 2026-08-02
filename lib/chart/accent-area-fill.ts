import { isDarkDocument, resolveFsColor } from "@/lib/theme/resolve-fs-color";

function hexToRgba(hex: string, alpha: number): string {
  const m = hex.trim().match(/^#([0-9a-f]{6})$/i);
  if (!m) return hex;
  const v = parseInt(m[1]!, 16);
  const r = (v >> 16) & 255;
  const g = (v >> 8) & 255;
  const b = v & 255;
  return `rgba(${r},${g},${b},${alpha})`;
}

/** True when `--fs-panel` (raw cascade) is a dark fill — matches visible plot backdrop. */
function rawPanelLooksDark(): boolean {
  if (typeof document === "undefined") return isDarkDocument();
  const raw = getComputedStyle(document.documentElement).getPropertyValue("--fs-panel").trim();
  const hex = raw.match(/^#([0-9a-f]{6})$/i)?.[1];
  if (hex) {
    const v = parseInt(hex, 16);
    const r = (v >> 16) & 255;
    const g = (v >> 8) & 255;
    const b = v & 255;
    return (r + g + b) / 3 < 96;
  }
  const rgb = raw.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  if (rgb) {
    return (Number(rgb[1]) + Number(rgb[2]) + Number(rgb[3])) / 3 < 96;
  }
  return isDarkDocument();
}

/**
 * Area fill under accent lines — same hue as `--fs-accent`, opacity fades top → bottom.
 * Light and dark both tint the accent (not the navy `--fs-accent-soft` wash).
 *
 * Uses the *computed* panel luminance (not only `html.dark`) so theme-boot / HMR
 * never paints a dark-only fill on a still-light plot.
 */
export function accentAreaGradientColors(): { top: string; bottom: string } {
  const accent = resolveFsColor("--fs-accent");
  const accentHex = accent.match(/^#[0-9a-f]{6}$/i)?.[0] ?? "#364aff";
  if (rawPanelLooksDark()) {
    return {
      top: hexToRgba(accentHex, 0.28),
      bottom: hexToRgba(accentHex, 0.02),
    };
  }
  return {
    top: hexToRgba(accentHex, 0.22),
    bottom: hexToRgba(accentHex, 0.02),
  };
}

/**
 * Opaque underlay under holdings blue fill (masks quarter bars).
 * Light: white (as before). Dark: panel so it doesn’t flash white.
 */
export function holdingsAreaUnderlayColors(): { top: string; bottom: string } {
  if (rawPanelLooksDark()) {
    const panel = resolveFsColor("--fs-panel");
    return { top: panel, bottom: panel };
  }
  return {
    top: "rgba(255, 255, 255, 0.97)",
    bottom: "#ffffff",
  };
}

/** Baseline series green/red area fills — uses theme `--fs-up` / `--fs-down`. */
export function baselineUpDownFillColors(variant: "bright" | "dim" = "bright"): {
  topFillColor1: string;
  topFillColor2: string;
  topLineColor: string;
  bottomFillColor1: string;
  bottomFillColor2: string;
  bottomLineColor: string;
} {
  const up = resolveFsColor("--fs-up");
  const down = resolveFsColor("--fs-down");
  const upHex = up.match(/^#[0-9a-f]{6}$/i)?.[0] ?? "#16a34a";
  const downHex = down.match(/^#[0-9a-f]{6}$/i)?.[0] ?? "#dc2626";
  if (variant === "dim") {
    return {
      topFillColor1: hexToRgba(upHex, 0.08),
      topFillColor2: hexToRgba(upHex, 0.02),
      topLineColor: hexToRgba(upHex, 0.38),
      bottomFillColor1: hexToRgba(downHex, 0.02),
      bottomFillColor2: hexToRgba(downHex, 0.08),
      bottomLineColor: hexToRgba(downHex, 0.38),
    };
  }
  return {
    topFillColor1: hexToRgba(upHex, rawPanelLooksDark() ? 0.22 : 0.2),
    topFillColor2: hexToRgba(upHex, 0.03),
    topLineColor: up,
    bottomFillColor1: hexToRgba(downHex, 0.03),
    bottomFillColor2: hexToRgba(downHex, rawPanelLooksDark() ? 0.22 : 0.18),
    bottomLineColor: down,
  };
}
