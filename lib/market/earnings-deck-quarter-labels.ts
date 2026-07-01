/** Labels to try when matching scraped IR decks to a fiscal period row. */
export function earningsDeckLookupLabels(fiscalPeriodLabel: string | null | undefined): string[] {
  const label = fiscalPeriodLabel?.trim();
  if (!label) return [];
  const out = [label];
  const q4 = label.match(/^Q4\s+(\d{4})$/i);
  if (q4) out.push(`FY ${q4[1]}`);
  return [...new Set(out)];
}
