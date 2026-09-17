/**
 * SnapTrade square logos vary: Alpaca ships a circular mark; eToro a transparent glyph.
 * Mirrors iOS `BrokerageLogoRenderStyle` / `BrokerageLogoStyleResolver`.
 */

export type BrokerageLogoRenderStyle =
  | { kind: "fullBleed" }
  | { kind: "markOnBrandBackdrop"; backdrop: string; tint: string }
  | { kind: "markOnBrandPlate"; backdrop: string }
  | { kind: "markOnSurface" };

/** Opaque pixel ratio below which the asset is treated as a mark, not a filled tile. */
const FILLED_TILE_OPAQUE_RATIO_THRESHOLD = 0.35;

export function matchesBrokerage(
  slug: string | null | undefined,
  displayName: string,
  target: string,
): boolean {
  const normalized = target.trim().toUpperCase();
  if (!normalized) return false;

  const slugNorm = slug?.trim().toUpperCase() ?? "";
  if (slugNorm === normalized || slugNorm.startsWith(`${normalized}-`)) {
    return true;
  }

  const name = displayName.trim().toLowerCase();
  switch (normalized) {
    case "ETORO":
      return name.includes("etoro");
    case "BINANCE":
      return name.includes("binance");
    case "ALPACA":
      return name.includes("alpaca");
    default:
      return false;
  }
}

/** Known brand overrides (same as iOS) — applied before opacity sampling. */
export function resolveBrokerageLogoStyleFromMeta(
  slug: string | null | undefined,
  displayName: string,
): BrokerageLogoRenderStyle | null {
  if (matchesBrokerage(slug, displayName, "ETORO")) {
    return { kind: "markOnBrandBackdrop", backdrop: "#6AA621", tint: "#FFFFFF" };
  }
  if (matchesBrokerage(slug, displayName, "BINANCE")) {
    return { kind: "markOnBrandBackdrop", backdrop: "#F3BA2F", tint: "#FFFFFF" };
  }
  if (matchesBrokerage(slug, displayName, "ALPACA")) {
    return { kind: "markOnBrandPlate", backdrop: "#FFD200" };
  }
  return null;
}

/**
 * Sample opaque pixel ratio from a loaded image (0…1).
 * Returns `1` when sampling fails (treat as filled tile).
 */
export function imageOpaquePixelRatio(
  img: CanvasImageSource & { width?: number; height?: number; naturalWidth?: number; naturalHeight?: number },
  sampleStride = 4,
  alphaThreshold = 128,
): number {
  const width =
    "naturalWidth" in img && typeof img.naturalWidth === "number" && img.naturalWidth > 0 ?
      img.naturalWidth
    : typeof img.width === "number" ? img.width
    : 0;
  const height =
    "naturalHeight" in img && typeof img.naturalHeight === "number" && img.naturalHeight > 0 ?
      img.naturalHeight
    : typeof img.height === "number" ? img.height
    : 0;
  if (width <= 0 || height <= 0) return 1;

  try {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return 1;
    ctx.drawImage(img, 0, 0);
    const { data } = ctx.getImageData(0, 0, width, height);
    const stride = Math.max(1, sampleStride);
    let opaque = 0;
    let sampled = 0;
    for (let y = 0; y < height; y += stride) {
      for (let x = 0; x < width; x += stride) {
        const a = data[(y * width + x) * 4 + 3] ?? 0;
        if (a > alphaThreshold) opaque += 1;
        sampled += 1;
      }
    }
    if (sampled === 0) return 1;
    return opaque / sampled;
  } catch {
    // Cross-origin without CORS — fall back to filled tile.
    return 1;
  }
}

export function resolveBrokerageLogoStyleFromImage(
  img: CanvasImageSource & { width?: number; height?: number; naturalWidth?: number; naturalHeight?: number },
  slug: string | null | undefined,
  displayName: string,
): BrokerageLogoRenderStyle {
  const known = resolveBrokerageLogoStyleFromMeta(slug, displayName);
  if (known) return known;

  const opaqueRatio = imageOpaquePixelRatio(img);
  if (opaqueRatio < FILLED_TILE_OPAQUE_RATIO_THRESHOLD) {
    return { kind: "markOnSurface" };
  }
  return { kind: "fullBleed" };
}
