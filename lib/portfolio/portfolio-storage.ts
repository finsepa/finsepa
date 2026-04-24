import type {
  PortfolioEntry,
  PortfolioHolding,
  PortfolioTransaction,
} from "@/components/portfolio/portfolio-types";
import { normalizePortfolioEntry } from "@/components/portfolio/portfolio-types";

/** Legacy key (pre–per-user storage). Migrated once into {@link portfolioStorageKeyForUser}. */
export const PORTFOLIO_STORAGE_KEY = "finsepa.portfolio.v1" as const;
const CURRENT_VERSION = 1;

/** Last portfolio picked in the UI (top bar / forms); survives server merge and pre-hydrate timing. */
const LAST_SELECTED_PORTFOLIO_KEY_PREFIX = "finsepa.portfolio.lastSelected.v1" as const;

export function portfolioLastSelectedStorageKey(userId: string): string {
  return `${LAST_SELECTED_PORTFOLIO_KEY_PREFIX}.u.${userId}`;
}

export function saveLastSelectedPortfolioId(userId: string, portfolioId: string | null): void {
  if (typeof window === "undefined") return;
  try {
    const key = portfolioLastSelectedStorageKey(userId);
    if (portfolioId == null || portfolioId.length === 0) {
      window.localStorage.removeItem(key);
    } else {
      window.localStorage.setItem(key, portfolioId);
    }
  } catch {
    /* quota / private mode */
  }
}

export function loadLastSelectedPortfolioId(userId: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    const v = window.localStorage.getItem(portfolioLastSelectedStorageKey(userId));
    return v != null && v.length > 0 ? v : null;
  } catch {
    return null;
  }
}

/** Prefer last UI selection when still valid; else blob; else first portfolio. */
export function coalesceSelectedPortfolioId(
  portfolios: readonly { id: string }[],
  blobSelected: string | null,
  lastTouched: string | null,
): string | null {
  const ids = new Set(portfolios.map((p) => p.id));
  if (lastTouched != null && lastTouched.length > 0 && ids.has(lastTouched)) return lastTouched;
  if (blobSelected != null && blobSelected.length > 0 && ids.has(blobSelected)) return blobSelected;
  return portfolios[0]?.id ?? null;
}

export function portfolioStorageKeyForUser(userId: string): string {
  return `${PORTFOLIO_STORAGE_KEY}.u.${userId}`;
}

export type PersistedPortfolioState = {
  v: number;
  /** Client-side last save time (ms); used with server `updated_at` to avoid overwriting newer local data on login. */
  savedAt?: number;
  portfolios: PortfolioEntry[];
  selectedPortfolioId: string | null;
  holdingsByPortfolioId: Record<string, PortfolioHolding[]>;
  transactionsByPortfolioId: Record<string, PortfolioTransaction[]>;
};

function isRecord(x: unknown): x is Record<string, unknown> {
  return x !== null && typeof x === "object" && !Array.isArray(x);
}

function isRawPortfolioEntry(x: unknown): x is { id: string; name: string; privacy?: unknown; kind?: unknown; combinedFrom?: unknown } {
  if (!isRecord(x)) return false;
  if (typeof x.id !== "string" || typeof x.name !== "string") return false;
  const pr = x.privacy;
  if (pr !== undefined && pr !== "private" && pr !== "public") return false;
  const k = x.kind;
  if (k !== undefined && k !== "standard" && k !== "combined") return false;
  const cf = x.combinedFrom;
  if (cf !== undefined && (!Array.isArray(cf) || !cf.every((t): t is string => typeof t === "string"))) {
    return false;
  }
  return true;
}

function isPortfolioHolding(x: unknown): x is PortfolioHolding {
  if (!isRecord(x)) return false;
  return (
    typeof x.id === "string" &&
    typeof x.symbol === "string" &&
    typeof x.name === "string" &&
    (x.logoUrl === null || typeof x.logoUrl === "string") &&
    typeof x.shares === "number" &&
    typeof x.avgPrice === "number" &&
    typeof x.costBasis === "number" &&
    typeof x.currentValue === "number" &&
    typeof x.marketPrice === "number"
  );
}

function isPortfolioTransaction(x: unknown): x is PortfolioTransaction {
  if (!isRecord(x)) return false;
  const kind = x.kind;
  if (kind !== "trade" && kind !== "cash" && kind !== "income" && kind !== "expense") return false;
  const holdingOk = x.holdingId === undefined || typeof x.holdingId === "string";
  const noteOk = x.note === undefined || x.note === null || typeof x.note === "string";
  return (
    noteOk &&
    holdingOk &&
    typeof x.id === "string" &&
    typeof x.portfolioId === "string" &&
    typeof x.operation === "string" &&
    typeof x.symbol === "string" &&
    typeof x.name === "string" &&
    (x.logoUrl === null || typeof x.logoUrl === "string") &&
    typeof x.date === "string" &&
    typeof x.shares === "number" &&
    typeof x.price === "number" &&
    typeof x.fee === "number" &&
    typeof x.sum === "number" &&
    (x.profitPct == null || typeof x.profitPct === "number") &&
    (x.profitUsd == null || typeof x.profitUsd === "number")
  );
}

type RawPersistedState = Omit<PersistedPortfolioState, "portfolios"> & {
  portfolios: Array<{ id: string; name: string; privacy?: unknown }>;
};

function normalizeState(state: RawPersistedState): PersistedPortfolioState {
  const ids = new Set(state.portfolios.map((p) => p.id));
  let selected = state.selectedPortfolioId;
  if (selected && !ids.has(selected)) {
    selected = state.portfolios[0]?.id ?? null;
  }
  if (!selected && state.portfolios.length > 0) {
    selected = state.portfolios[0]!.id;
  }

  const normPortfolios = state.portfolios.filter(isRawPortfolioEntry).map(normalizePortfolioEntry);

  const holdings: Record<string, PortfolioHolding[]> = {};
  for (const id of ids) {
    const rows = state.holdingsByPortfolioId[id];
    holdings[id] = Array.isArray(rows) ? rows.filter(isPortfolioHolding) : [];
  }

  const transactions: Record<string, PortfolioTransaction[]> = {};
  for (const id of ids) {
    const rows = state.transactionsByPortfolioId[id];
    transactions[id] = Array.isArray(rows) ? rows.filter(isPortfolioTransaction) : [];
  }

  for (const p of normPortfolios) {
    if (p.kind === "combined") {
      holdings[p.id] = [];
      transactions[p.id] = [];
    }
  }

  return {
    v: CURRENT_VERSION,
    savedAt: typeof state.savedAt === "number" && Number.isFinite(state.savedAt) ? state.savedAt : undefined,
    portfolios: normPortfolios,
    selectedPortfolioId: selected,
    holdingsByPortfolioId: holdings,
    transactionsByPortfolioId: transactions,
  };
}

function parsePersistedPortfolioRaw(raw: string): PersistedPortfolioState | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) return null;
    if (parsed.v !== CURRENT_VERSION) return null;
    if (!Array.isArray(parsed.portfolios) || !parsed.portfolios.every(isRawPortfolioEntry)) return null;
    if (parsed.selectedPortfolioId !== null && typeof parsed.selectedPortfolioId !== "string") {
      return null;
    }
    if (
      parsed.savedAt !== undefined &&
      (typeof parsed.savedAt !== "number" || !Number.isFinite(parsed.savedAt))
    ) {
      return null;
    }
    if (!isRecord(parsed.holdingsByPortfolioId) || !isRecord(parsed.transactionsByPortfolioId)) {
      return null;
    }

    const holdingsByPortfolioId: Record<string, PortfolioHolding[]> = {};
    for (const [k, v] of Object.entries(parsed.holdingsByPortfolioId)) {
      if (!Array.isArray(v) || !v.every(isPortfolioHolding)) return null;
      holdingsByPortfolioId[k] = v;
    }
    const transactionsByPortfolioId: Record<string, PortfolioTransaction[]> = {};
    for (const [k, v] of Object.entries(parsed.transactionsByPortfolioId)) {
      if (!Array.isArray(v) || !v.every(isPortfolioTransaction)) return null;
      transactionsByPortfolioId[k] = v;
    }

    if (parsed.portfolios.length === 0) return null;

    return normalizeState({
      v: CURRENT_VERSION,
      savedAt: typeof parsed.savedAt === "number" ? parsed.savedAt : undefined,
      portfolios: parsed.portfolios,
      selectedPortfolioId: parsed.selectedPortfolioId,
      holdingsByPortfolioId,
      transactionsByPortfolioId,
    });
  } catch {
    return null;
  }
}

/** Validates a JSON body from the API (same shape as localStorage). */
export function parsePersistedPortfolioUnknown(body: unknown): PersistedPortfolioState | null {
  if (body == null) return null;
  try {
    const raw = typeof body === "string" ? body : JSON.stringify(body);
    return parsePersistedPortfolioRaw(raw);
  } catch {
    return null;
  }
}

/**
 * Loads persisted portfolio workspace for a signed-in user: user key first, then legacy key (migrated).
 */
export function loadPersistedPortfolioStateForUser(userId: string): PersistedPortfolioState | null {
  if (typeof window === "undefined") return null;
  try {
    const userKey = portfolioStorageKeyForUser(userId);
    const fromUser = window.localStorage.getItem(userKey);
    if (fromUser) {
      const s = parsePersistedPortfolioRaw(fromUser);
      if (s) return s;
    }
    const legacy = window.localStorage.getItem(PORTFOLIO_STORAGE_KEY);
    if (legacy) {
      const s = parsePersistedPortfolioRaw(legacy);
      if (s) {
        savePersistedPortfolioStateForUser(userId, s);
        window.localStorage.removeItem(PORTFOLIO_STORAGE_KEY);
        return s;
      }
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Loads persisted portfolio workspace from `localStorage` (legacy only — prefer {@link loadPersistedPortfolioStateForUser}).
 * Returns `null` if missing, corrupt, or invalid — caller keeps in-memory defaults.
 */
export function loadPersistedPortfolioState(): PersistedPortfolioState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(PORTFOLIO_STORAGE_KEY);
    if (!raw) return null;
    return parsePersistedPortfolioRaw(raw);
  } catch {
    return null;
  }
}

export function savePersistedPortfolioStateForUser(userId: string, state: PersistedPortfolioState): void {
  if (typeof window === "undefined") return;
  try {
    const normalized = normalizeState(state);
    window.localStorage.setItem(portfolioStorageKeyForUser(userId), JSON.stringify(normalized));
  } catch {
    /* quota or private mode */
  }
}

export function savePersistedPortfolioState(state: PersistedPortfolioState): void {
  if (typeof window === "undefined") return;
  try {
    const normalized = normalizeState(state);
    window.localStorage.setItem(PORTFOLIO_STORAGE_KEY, JSON.stringify(normalized));
  } catch {
    /* quota or private mode */
  }
}
