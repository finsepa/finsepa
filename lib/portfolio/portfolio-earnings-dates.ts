export type PortfolioEarningsDateEntry = {
  /** Formatted next earnings date, or null when unknown / N/A. */
  earningsDateDisplay: string | null;
  /** Fiscal quarter short label e.g. "Q2"; null when unknown. */
  fiscalQuarter: string | null;
  /** `YYYY-MM-DD` for countdown; null when unknown / N/A. */
  earningsDateYmd: string | null;
  /** Whole calendar days until earnings; null when unknown / N/A. */
  daysLeft: number | null;
  /** True for crypto / ETFs — UI should show a dash. */
  notApplicable: boolean;
};

/** e.g. "Q2, Jul 22, 2026" when quarter is known. */
export function formatPortfolioEarningsDateLabel(entry: {
  earningsDateDisplay: string | null;
  fiscalQuarter: string | null;
}): string | null {
  const display = entry.earningsDateDisplay?.trim() || null;
  if (!display) return null;
  const quarter = entry.fiscalQuarter?.trim() || null;
  if (quarter && /^Q[1-4]$/i.test(quarter)) {
    return `${quarter.toUpperCase()}, ${display}`;
  }
  return display;
}
