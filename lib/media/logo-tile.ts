import "server-only";

import sharp from "sharp";

/** Bump when tile rendering changes so cached tiles regenerate. */
export const LOGO_TILE_VERSION = 2;

export const LOGO_TILE_SIZE = 256;
/**
 * Mark corners sit on a circle of this radius (share of tile side), so wide wordmarks get more
 * width than square marks and the circular crop never clips them.
 */
const MARK_CORNER_RADIUS_RATIO = 0.43;

type Rgb = { r: number; g: number; b: number };

/** Single light tile for every white / transparent logo — keeps lists visually even. */
const NEUTRAL_TILE: Rgb = { r: 242, g: 244, b: 247 };
/** Near-white marks (rare in light-theme artwork) need contrast. */
const DARK_TILE: Rgb = { r: 28, g: 28, b: 30 };

const ALPHA_SOLID = 24;

function colorDistance(a: Rgb, b: Rgb): number {
  return Math.sqrt((a.r - b.r) ** 2 + (a.g - b.g) ** 2 + (a.b - b.b) ** 2);
}

function isNearWhite(c: Rgb): boolean {
  return Math.min(c.r, c.g, c.b) >= 232;
}

function luminance(c: Rgb): number {
  return (0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b) / 255;
}

type Raw = { data: Buffer; width: number; height: number };

function pixelAt(raw: Raw, x: number, y: number): { c: Rgb; a: number } {
  const i = (y * raw.width + x) * 4;
  return { c: { r: raw.data[i]!, g: raw.data[i + 1]!, b: raw.data[i + 2]! }, a: raw.data[i + 3]! };
}

/** Average of a small square at each corner — robust to anti-aliased edges. */
function cornerSamples(raw: Raw): { c: Rgb; a: number }[] {
  const s = Math.max(2, Math.floor(Math.min(raw.width, raw.height) * 0.03));
  const corners: [number, number][] = [
    [0, 0],
    [raw.width - s, 0],
    [0, raw.height - s],
    [raw.width - s, raw.height - s],
  ];
  return corners.map(([x0, y0]) => {
    let r = 0;
    let g = 0;
    let b = 0;
    let a = 0;
    let n = 0;
    for (let y = y0; y < y0 + s; y++) {
      for (let x = x0; x < x0 + s; x++) {
        const p = pixelAt(raw, x, y);
        r += p.c.r;
        g += p.c.g;
        b += p.c.b;
        a += p.a;
        n++;
      }
    }
    return { c: { r: r / n, g: g / n, b: b / n }, a: a / n };
  });
}

/** Opaque, uniform corners → the artwork carries its own background color. */
function detectOpaqueBackground(raw: Raw): Rgb | null {
  const corners = cornerSamples(raw);
  if (corners.some((k) => k.a < 240)) return null;
  const ref = corners[0]!.c;
  if (corners.some((k) => colorDistance(k.c, ref) > 28)) return null;
  const n = corners.length;
  return {
    r: corners.reduce((s, k) => s + k.c.r, 0) / n,
    g: corners.reduce((s, k) => s + k.c.g, 0) / n,
    b: corners.reduce((s, k) => s + k.c.b, 0) / n,
  };
}

/** Make pixels close to the background transparent (soft ramp keeps anti-aliasing clean). */
function colorToAlpha(raw: Raw, bg: Rgb): Raw {
  const out = Buffer.from(raw.data);
  for (let i = 0; i < out.length; i += 4) {
    const d = colorDistance({ r: out[i]!, g: out[i + 1]!, b: out[i + 2]! }, bg);
    const keep = Math.max(0, Math.min(1, (d - 14) / 36));
    out[i + 3] = Math.round(out[i + 3]! * keep);
  }
  return { data: out, width: raw.width, height: raw.height };
}

function opaqueBounds(raw: Raw): { left: number; top: number; width: number; height: number; count: number } | null {
  let minX = raw.width;
  let minY = raw.height;
  let maxX = -1;
  let maxY = -1;
  let count = 0;
  for (let y = 0; y < raw.height; y++) {
    for (let x = 0; x < raw.width; x++) {
      if (raw.data[(y * raw.width + x) * 4 + 3]! < ALPHA_SOLID) continue;
      count++;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  if (maxX < 0) return null;
  return { left: minX, top: minY, width: maxX - minX + 1, height: maxY - minY + 1, count };
}

function averageMarkColor(raw: Raw): Rgb {
  let r = 0;
  let g = 0;
  let b = 0;
  let n = 0;
  for (let i = 0; i < raw.data.length; i += 4) {
    if (raw.data[i + 3]! < 128) continue;
    r += raw.data[i]!;
    g += raw.data[i + 1]!;
    b += raw.data[i + 2]!;
    n++;
  }
  return n ? { r: r / n, g: g / n, b: b / n } : NEUTRAL_TILE;
}

/** Coin / round badge: square bbox that is ~a filled disc. */
function isRoundBadge(bounds: NonNullable<ReturnType<typeof opaqueBounds>>, raw: Raw): boolean {
  const aspect = bounds.width / bounds.height;
  if (aspect < 0.92 || aspect > 1.08) return false;
  if (bounds.width < raw.width * 0.55) return false;
  const discArea = (Math.PI / 4) * bounds.width * bounds.height;
  const fill = bounds.count / discArea;
  return fill > 0.9 && fill < 1.12;
}

/** Near-solid square bbox (opaque tile art with transparent margins). */
function isFilledSquare(bounds: NonNullable<ReturnType<typeof opaqueBounds>>): boolean {
  const aspect = bounds.width / bounds.height;
  if (aspect < 0.85 || aspect > 1.18) return false;
  return bounds.count / (bounds.width * bounds.height) >= 0.9;
}

/** Largest box of this aspect whose corners stay on the inner circle. */
function markBoxForAspect(aspect: number): { width: number; height: number } {
  const diameter = 2 * MARK_CORNER_RADIUS_RATIO * LOGO_TILE_SIZE;
  const a = Math.max(0.1, Math.min(10, aspect));
  const height = diameter / Math.sqrt(1 + a * a);
  return { width: Math.round(height * a), height: Math.round(height) };
}

async function encodeRaw(raw: Raw): Promise<sharp.Sharp> {
  return sharp(raw.data, { raw: { width: raw.width, height: raw.height, channels: 4 } });
}

/**
 * TipRanks-style uniform tile: every logo becomes a filled square (brand or neutral color) with the
 * mark centered at a consistent size, so lists look even in light and dark mode alike.
 * Returns null when the source has no visible mark.
 */
export async function renderLogoTile(input: Buffer): Promise<Buffer | null> {
  const { data, info } = await sharp(input)
    .ensureAlpha()
    .resize(LOGO_TILE_SIZE, LOGO_TILE_SIZE, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .raw()
    .toBuffer({ resolveWithObject: true });
  const source: Raw = { data, width: info.width, height: info.height };

  const ownBg = detectOpaqueBackground(source);
  const mark = ownBg ? colorToAlpha(source, ownBg) : source;
  const bounds = opaqueBounds(mark);
  if (!bounds) {
    if (!ownBg) return null;
    // Single-color cutout art (mark punched out of a solid square) — keep it whole on the neutral tile.
    return sharp({
      create: {
        width: LOGO_TILE_SIZE,
        height: LOGO_TILE_SIZE,
        channels: 4,
        background: { ...NEUTRAL_TILE, alpha: 1 },
      },
    })
      .composite([{ input: await (await encodeRaw(source)).png().toBuffer() }])
      .png()
      .toBuffer();
  }

  // Edge-to-edge artwork (photo-like or full-bleed brand tile) — already a tile.
  if (ownBg && bounds.width >= source.width * 0.92 && bounds.height >= source.height * 0.92) {
    return sharp(input).resize(LOGO_TILE_SIZE, LOGO_TILE_SIZE, { fit: "cover" }).png().toBuffer();
  }

  if (!ownBg && isRoundBadge(bounds, mark)) {
    const img = await encodeRaw(mark);
    return img
      .extract(bounds)
      .resize(LOGO_TILE_SIZE, LOGO_TILE_SIZE, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer();
  }

  // Solid square artwork floating in transparent padding (Home Depot, Solana) — it is the tile.
  if (!ownBg && isFilledSquare(bounds)) {
    const img = await encodeRaw(mark);
    return img.extract(bounds).resize(LOGO_TILE_SIZE, LOGO_TILE_SIZE, { fit: "cover" }).png().toBuffer();
  }

  let tile: Rgb;
  if (ownBg) tile = isNearWhite(ownBg) ? NEUTRAL_TILE : ownBg;
  else {
    const markColor = averageMarkColor(mark);
    tile = luminance(markColor) > 0.86 && isNearWhite(markColor) ? DARK_TILE : NEUTRAL_TILE;
  }

  const { width: boxW, height: boxH } = markBoxForAspect(bounds.width / bounds.height);
  const markPng = await (await encodeRaw(mark))
    .extract(bounds)
    .resize(boxW, boxH, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();

  return sharp({
    create: {
      width: LOGO_TILE_SIZE,
      height: LOGO_TILE_SIZE,
      channels: 4,
      background: { r: Math.round(tile.r), g: Math.round(tile.g), b: Math.round(tile.b), alpha: 1 },
    },
  })
    .composite([{ input: markPng, gravity: "center" }])
    .png()
    .toBuffer();
}
