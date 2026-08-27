/**
 * Shared crypto USD display precision — header, chart axis, and tip labels.
 * Low-priced coins need more fraction digits so $1.4405 does not collapse to $1.44.
 */
export function cryptoUsdFractionDigits(value: number): number {
  if (!Number.isFinite(value)) return 2;
  const abs = Math.abs(value);
  if (abs < 1) return 6;
  if (abs < 100) return 4;
  return 2;
}

/** `$1.4405` / `$70,500.12` — matches crypto asset header. */
export function formatCryptoUsd(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  const max = cryptoUsdFractionDigits(value);
  return `$${value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: max,
  })}`;
}

/** Axis / last-value label without `$` (Lightweight Charts priceFormatter). */
export function formatCryptoUsdAxis(value: number): string {
  if (!Number.isFinite(value)) return "—";
  const max = cryptoUsdFractionDigits(value);
  return value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: max,
  });
}

/** Absolute change amount using the same digit rules as the reference price. */
export function formatCryptoUsdChangeAbs(
  value: number | null | undefined,
  refPrice: number | null | undefined,
): string {
  if (value == null || !Number.isFinite(value)) return "—";
  const max =
    refPrice != null && Number.isFinite(refPrice) ? cryptoUsdFractionDigits(refPrice) : 2;
  return value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: max,
  });
}
