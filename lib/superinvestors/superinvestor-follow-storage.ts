/** Client-only followed superinvestor profile paths (e.g. `/superinvestors/berkshire-hathaway`). */

const STORAGE_KEY = "finsepa.superinvestor-follow.v1";

export type SuperinvestorFollowSnapshot = {
  v: 1;
  hrefs: string[];
};

function storageKeyForUser(userId: string | null): string {
  if (userId && userId.length > 0) return `${STORAGE_KEY}.u.${userId}`;
  return `${STORAGE_KEY}.guest`;
}

/** Normalize to a canonical profile path without query/hash. */
export function normalizeSuperinvestorFollowHref(href: string): string {
  const trimmed = href.trim();
  if (!trimmed) return "";
  const withLeading = trimmed.startsWith("/") ? trimmed : `/superinvestors/${trimmed}`;
  const path = withLeading.split(/[?#]/)[0] ?? withLeading;
  if (!path.startsWith("/superinvestors/")) return path;
  return path.replace(/\/+$/, "") || path;
}

function readRaw(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw) as Partial<SuperinvestorFollowSnapshot>;
    if (!parsed || parsed.v !== 1 || !Array.isArray(parsed.hrefs)) return [];
    return [...new Set(parsed.hrefs.map((h) => normalizeSuperinvestorFollowHref(String(h))).filter(Boolean))];
  } catch {
    return [];
  }
}

export function readSuperinvestorFollowLocal(userId: string | null = null): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(storageKeyForUser(userId));
    if (!raw) return [];
    return readRaw(raw);
  } catch {
    return [];
  }
}

export const SUPERINVESTOR_FOLLOW_CHANGED_EVENT = "finsepa:superinvestor-follow-changed";

export function notifySuperinvestorFollowChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(SUPERINVESTOR_FOLLOW_CHANGED_EVENT));
}

export function writeSuperinvestorFollowLocal(
  hrefs: string[],
  userId: string | null = null,
  opts?: { notify?: boolean },
): void {
  if (typeof window === "undefined") return;
  const normalized = [...new Set(hrefs.map(normalizeSuperinvestorFollowHref).filter(Boolean))];
  const payload: SuperinvestorFollowSnapshot = { v: 1, hrefs: normalized };
  try {
    window.localStorage.setItem(storageKeyForUser(userId), JSON.stringify(payload));
    if (opts?.notify !== false) {
      notifySuperinvestorFollowChanged();
    }
  } catch {
    /* ignore quota / private mode */
  }
}
