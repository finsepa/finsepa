/**
 * US-style money/number fields: thousands commas + `.` decimals (e.g. `25,000.00`).
 */

/** Parses typed or pasted values; strips spaces and thousands commas. */
export function parseUsdStyleNumber(raw: string): number {
  const t = raw.trim().replace(/\s/g, "").replace(/,/g, "");
  if (!t || t === "." || t === "-") return 0;
  const n = Number.parseFloat(t);
  return Number.isFinite(n) ? n : 0;
}

export function formatUsdMoney2dp(n: number): string {
  if (!Number.isFinite(n)) return "";
  return n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** Allow digits, commas, and a single decimal point while typing. */
export function sanitizeUsdMoneyTyping(raw: string): string {
  let s = raw.replace(/[^\d.,]/g, "");
  const firstDot = s.indexOf(".");
  if (firstDot !== -1) {
    s = s.slice(0, firstDot + 1) + s.slice(firstDot + 1).replace(/\./g, "");
  }
  return s;
}
