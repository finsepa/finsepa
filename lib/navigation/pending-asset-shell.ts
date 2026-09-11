/**
 * In-memory only — soft-nav optimistic asset shell.
 * Hard refresh / new tab → empty (no stale ticker/price).
 */

export type PendingAssetShellKind = "stock" | "crypto" | "index" | "currency";

export type PendingAssetShell = {
  kind: PendingAssetShellKind;
  /** Route symbol (e.g. ASML, BTC, GSPC.INDX). */
  symbol: string;
  name?: string | null;
  price?: number | null;
  /** 1D change percent when known from screener/watchlist. */
  changePct?: number | null;
  logoUrl?: string | null;
  /** Screener market-cap rank (#41) when navigating from the companies table. */
  screenerRank?: number | null;
  /** Listing exchange (`NYSE`, `NASDAQ`) when known from screener. */
  exchange?: string | null;
  /** ISO country for flag emoji when known. */
  countryIso?: string | null;
  /** Absolute href used for navigation (`/stock/ASML`). */
  href: string;
  setAt: number;
};

/** Seed fields before navigation — href filled by {@link setPendingAssetShell}. */
export type PendingAssetShellSeed = Omit<PendingAssetShell, "href" | "setAt"> & {
  href?: string;
};

let current: PendingAssetShell | null = null;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

export function getPendingAssetShell(): PendingAssetShell | null {
  return current;
}

export function setPendingAssetShell(seed: PendingAssetShellSeed & { href: string }): void {
  const symbol = seed.symbol.trim().toUpperCase();
  const href = seed.href.trim();
  if (!symbol || !href) return;
  current = {
    kind: seed.kind,
    symbol,
    name: seed.name?.trim() || null,
    price: typeof seed.price === "number" && Number.isFinite(seed.price) ? seed.price : null,
    changePct:
      typeof seed.changePct === "number" && Number.isFinite(seed.changePct) ? seed.changePct : null,
    logoUrl: seed.logoUrl?.trim() || null,
    screenerRank:
      typeof seed.screenerRank === "number" &&
      Number.isFinite(seed.screenerRank) &&
      seed.screenerRank > 0
        ? Math.trunc(seed.screenerRank)
        : null,
    exchange: seed.exchange?.trim() || null,
    countryIso: seed.countryIso?.trim()?.toUpperCase() || null,
    href,
    setAt: Date.now(),
  };
  emit();
}

export function clearPendingAssetShell(): void {
  if (!current) return;
  current = null;
  emit();
}

/** Clear only when the mounted page matches the pending symbol (avoid wiping a newer click). */
export function clearPendingAssetShellIfMatch(
  kind: PendingAssetShellKind,
  symbol: string,
): void {
  const sym = symbol.trim().toUpperCase();
  if (!current || current.kind !== kind || current.symbol !== sym) return;
  clearPendingAssetShell();
}

export function subscribePendingAssetShell(onStoreChange: () => void): () => void {
  listeners.add(onStoreChange);
  return () => {
    listeners.delete(onStoreChange);
  };
}

const ASSET_PATH_RE =
  /^\/(stock|crypto|index|currency)\/([^/?#]+)/i;

export function parseAssetPathname(pathname: string): {
  kind: PendingAssetShellKind;
  symbol: string;
} | null {
  const m = pathname.trim().match(ASSET_PATH_RE);
  if (!m) return null;
  const kind = m[1]!.toLowerCase() as PendingAssetShellKind;
  let symbol: string;
  try {
    symbol = decodeURIComponent(m[2]!).trim().toUpperCase();
  } catch {
    symbol = m[2]!.trim().toUpperCase();
  }
  if (!symbol) return null;
  return { kind, symbol };
}

export function pendingAssetShellMatchesPath(
  pending: PendingAssetShell | null | undefined,
  pathname: string,
): boolean {
  if (!pending) return false;
  const parsed = parseAssetPathname(pathname);
  if (!parsed) return false;
  return parsed.kind === pending.kind && parsed.symbol === pending.symbol;
}

export function watchlistKindToPendingAssetKind(
  kind: "stock" | "crypto" | "index" | "forex",
): PendingAssetShellKind {
  if (kind === "forex") return "currency";
  return kind;
}
