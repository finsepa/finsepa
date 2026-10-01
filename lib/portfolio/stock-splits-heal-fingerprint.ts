/**
 * Remembers which ledger shapes the continuous-price repair (`/api/portfolio/stock-splits`)
 * already checked, across page loads — each check fetches full EOD history per equity symbol.
 */

const STORAGE_KEY = "finsepa.portfolio.stock-splits-heal.v1";
const MAX_ENTRIES = 200;

function hashFingerprint(fp: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < fp.length; i++) {
    h ^= fp.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return `${(h >>> 0).toString(36)}:${fp.length}`;
}

function readAll(): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : null;
    return parsed && typeof parsed === "object" ? (parsed as Record<string, string>) : {};
  } catch {
    return {};
  }
}

export function isStockSplitsHealFingerprintChecked(portfolioId: string, fp: string): boolean {
  return readAll()[portfolioId] === hashFingerprint(fp);
}

export function markStockSplitsHealFingerprintChecked(portfolioId: string, fp: string): void {
  if (typeof window === "undefined") return;
  const all = readAll();
  delete all[portfolioId];
  all[portfolioId] = hashFingerprint(fp);
  const ids = Object.keys(all);
  for (const id of ids.slice(0, Math.max(0, ids.length - MAX_ENTRIES))) delete all[id];
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch {
    /* quota */
  }
}
