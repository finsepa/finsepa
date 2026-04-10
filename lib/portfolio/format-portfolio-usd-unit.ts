/**
 * Per-share / per-coin USD for portfolio tables — avoids `$0.00` for sub-penny crypto.
 */
export function formatPortfolioUsdPerUnit(n: number): string {
  const abs = Math.abs(n);
  let maxFractionDigits = 2;
  if (abs > 0 && abs < 0.000_1) maxFractionDigits = 8;
  else if (abs < 0.01) maxFractionDigits = 6;
  else if (abs < 1) maxFractionDigits = 4;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: maxFractionDigits,
  }).format(n);
}
