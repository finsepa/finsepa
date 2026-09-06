import "server-only";

import { unstable_cache } from "next/cache";

import type { Berkshire13fComparisonRow, Holding13fComparisonStatus } from "@/lib/superinvestors/types";
import { SUPERINVESTOR_REGISTRY } from "@/lib/superinvestors/superinvestor-registry";
import {
  buildSuperinvestorStockIndexFromProfileSnapshots,
  lookupStockSuperinvestorPositionsFromIndex,
  readSuperinvestorStockIndexSnapshot,
  upsertSuperinvestorStockIndexSnapshot,
} from "@/lib/superinvestors/superinvestor-stock-index-snapshot";

/** Matches per-fund 13F comparison caches in `berkshire-13f.ts`. */
const INDEX_REVALIDATE_SEC = 21_600;

export type StockSuperinvestorPosition = {
  superinvestorSlug: string;
  managerName: string;
  fundName: string;
  avatarSrc: string | null;
  weightPct: number;
  statusLabel: string | null;
  shares: number | null;
  valueUsd: number;
};

type NameIndexRow = {
  nameNorm: string;
  position: StockSuperinvestorPosition;
};

type StockSuperinvestorIndex = {
  byTicker: Record<string, StockSuperinvestorPosition[]>;
  byNameExact: Record<string, StockSuperinvestorPosition[]>;
  nameRows: NameIndexRow[];
};

function normalizeIssuerName(s: string): string {
  return s
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\b(inc|incorporated|corp|corporation|co|company|ltd|limited|plc|del|holdings)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function activityLabel(status: Holding13fComparisonStatus | null, sharesChangePct: number | null): string | null {
  if (!status) return null;
  if (status === "new") return "New";
  if (status === "unchanged") return "Unchanged";
  const pct =
    sharesChangePct != null && Number.isFinite(sharesChangePct) ? Math.abs(sharesChangePct).toFixed(2) : null;
  if (status === "add") return pct ? `Increased ${pct}%` : "Increased";
  if (status === "reduce") return pct ? `Reduced ${pct}%` : "Reduced";
  return null;
}

function positionFromRow(
  registry: (typeof SUPERINVESTOR_REGISTRY)[number],
  filerDisplayName: string,
  row: Berkshire13fComparisonRow,
): StockSuperinvestorPosition {
  return {
    superinvestorSlug: registry.slug,
    managerName: registry.managerName,
    fundName: registry.fundNameOverride ?? filerDisplayName,
    avatarSrc: registry.avatarSrc,
    weightPct: row.weight,
    statusLabel: activityLabel(row.status, row.sharesChangePct),
    shares: row.shares,
    valueUsd: row.valueUsd,
  };
}

function pushIndex(
  map: Record<string, StockSuperinvestorPosition[]>,
  key: string,
  position: StockSuperinvestorPosition,
) {
  const bucket = map[key];
  if (bucket) bucket.push(position);
  else map[key] = [position];
}

/**
 * Last-resort index via per-fund comparison loaders (SEC when snapshots miss).
 * Prefer {@link readSuperinvestorStockIndexSnapshot} / profile-snapshot build.
 */
async function buildStockSuperinvestorIndexViaRegistryLoad(): Promise<StockSuperinvestorIndex> {
  const byTicker: Record<string, StockSuperinvestorPosition[]> = {};
  const byNameExact: Record<string, StockSuperinvestorPosition[]> = {};
  const nameRows: NameIndexRow[] = [];

  const payloads = await Promise.all(
    SUPERINVESTOR_REGISTRY.map(async (registry) => {
      try {
        return { registry, data: await registry.load() };
      } catch {
        return { registry, data: null };
      }
    }),
  );

  for (const { registry, data } of payloads) {
    if (!data || data.source === "unavailable") continue;
    for (const row of data.rows) {
      const position = positionFromRow(registry, data.filerDisplayName, row);
      const ticker = (row.ticker ?? "").trim().toUpperCase();
      if (ticker) pushIndex(byTicker, ticker, position);
      const nameNorm = normalizeIssuerName(row.companyName);
      if (nameNorm) {
        pushIndex(byNameExact, nameNorm, position);
        nameRows.push({ nameNorm, position });
      }
    }
  }

  return { byTicker, byNameExact, nameRows };
}

const getStockSuperinvestorIndexCached = unstable_cache(
  buildStockSuperinvestorIndexViaRegistryLoad,
  ["stock-superinvestor-index-v2-registry-fallback"],
  { revalidate: INDEX_REVALIDATE_SEC },
);

const DEV_INDEX_MEMO_KEY = "13f:stock-superinvestor-index:v2";
const DEV_INDEX_TTL_MS = 30 * 60 * 1000;
const PROCESS_INDEX_MEMO_KEY = "13f:stock-superinvestor-index:process-v1";
const PROCESS_INDEX_TTL_MS = 30 * 60 * 1000;

type ProcessIndexMemo = {
  byTicker: Record<string, StockSuperinvestorPosition[]>;
  byNameExact: Record<string, StockSuperinvestorPosition[]>;
};

function readProcessIndexMemo(): ProcessIndexMemo | null {
  const g = globalThis as unknown as {
    __finsepaDevMemo?: Map<string, { exp: number; v: unknown }>;
  };
  if (!g.__finsepaDevMemo) return null;
  const hit = g.__finsepaDevMemo.get(PROCESS_INDEX_MEMO_KEY);
  if (!hit || hit.exp <= Date.now()) return null;
  return hit.v as ProcessIndexMemo;
}

function writeProcessIndexMemo(index: ProcessIndexMemo): void {
  const g = globalThis as unknown as {
    __finsepaDevMemo?: Map<string, { exp: number; v: unknown }>;
  };
  if (!g.__finsepaDevMemo) g.__finsepaDevMemo = new Map();
  g.__finsepaDevMemo.set(PROCESS_INDEX_MEMO_KEY, {
    exp: Date.now() + PROCESS_INDEX_TTL_MS,
    v: index,
  });
}

async function getStockSuperinvestorIndexFallback(): Promise<StockSuperinvestorIndex> {
  if (process.env.NODE_ENV === "production") {
    return getStockSuperinvestorIndexCached();
  }
  const g = globalThis as unknown as {
    __finsepaDevMemo?: Map<string, { exp: number; v: Promise<unknown> }>;
  };
  if (!g.__finsepaDevMemo) g.__finsepaDevMemo = new Map();
  const now = Date.now();
  const hit = g.__finsepaDevMemo.get(DEV_INDEX_MEMO_KEY);
  if (hit && hit.exp > now) return hit.v as Promise<StockSuperinvestorIndex>;
  const v = buildStockSuperinvestorIndexViaRegistryLoad();
  g.__finsepaDevMemo.set(DEV_INDEX_MEMO_KEY, { exp: now + DEV_INDEX_TTL_MS, v });
  return v;
}

/**
 * Fast path: process memo → durable inverted index (cron) → profile snapshots → registry load.
 * No EODHD on any path; SEC only on last-resort cold miss.
 */
export async function getStockSuperinvestorPositions(
  ticker: string,
  companyNameNorm: string | null = null,
): Promise<{ ticker: string; positions: StockSuperinvestorPosition[] }> {
  const sym = ticker.trim().toUpperCase();
  if (!sym) return { ticker: "", positions: [] };

  const memo = readProcessIndexMemo();
  if (memo) {
    return {
      ticker: sym,
      positions: lookupStockSuperinvestorPositionsFromIndex(
        memo.byTicker,
        memo.byNameExact,
        sym,
        companyNameNorm,
      ),
    };
  }

  const snap = await readSuperinvestorStockIndexSnapshot();
  if (snap) {
    writeProcessIndexMemo({ byTicker: snap.byTicker, byNameExact: snap.byNameExact });
    return {
      ticker: sym,
      positions: lookupStockSuperinvestorPositionsFromIndex(
        snap.byTicker,
        snap.byNameExact,
        sym,
        companyNameNorm,
      ),
    };
  }

  // Cold miss without durable index: build from per-CIK profile snapshots (Supabase reads only).
  try {
    const fromProfiles = await buildSuperinvestorStockIndexFromProfileSnapshots();
    if (fromProfiles.fundCount > 0) {
      writeProcessIndexMemo({
        byTicker: fromProfiles.byTicker,
        byNameExact: fromProfiles.byNameExact,
      });
      // Self-heal durable index so other instances skip the profile fan-out.
      void upsertSuperinvestorStockIndexSnapshot(fromProfiles.byTicker, fromProfiles.byNameExact);
      return {
        ticker: sym,
        positions: lookupStockSuperinvestorPositionsFromIndex(
          fromProfiles.byTicker,
          fromProfiles.byNameExact,
          sym,
          companyNameNorm,
        ),
      };
    }
  } catch {
    /* fall through to registry load */
  }

  const index = await getStockSuperinvestorIndexFallback();
  writeProcessIndexMemo({ byTicker: index.byTicker, byNameExact: index.byNameExact });
  let positions = index.byTicker[sym] ?? [];
  if (positions.length === 0 && companyNameNorm) {
    positions = lookupStockSuperinvestorPositionsFromIndex(
      index.byTicker,
      index.byNameExact,
      sym,
      companyNameNorm,
    );
  }

  return { ticker: sym, positions };
}
