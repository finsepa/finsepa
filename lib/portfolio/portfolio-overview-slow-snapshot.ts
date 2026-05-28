import "server-only";

import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { marketSnapshotReadEnabled } from "@/lib/market/market-snapshot-store";

const SEGMENT = "portfolio_overview_slow_v1";

export type PortfolioYieldSnapshot = { yieldPct: number | null };
export type PortfolioInceptionOpenSnapshot = { open: number | null };

function keyYieldPct(ticker: string): string | null {
  const t = ticker.trim().toUpperCase();
  if (!t) return null;
  return `portfolio_yield_pct_${t}`;
}

function keyInceptionOpen(ticker: string, ymd: string): string | null {
  const t = ticker.trim().toUpperCase();
  if (!t) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null;
  return `portfolio_inception_open_${t}_${ymd}`;
}

export async function readPortfolioYieldPctSnapshot(ticker: string): Promise<number | null | undefined> {
  const key = keyYieldPct(ticker);
  if (!key || !marketSnapshotReadEnabled()) return undefined;
  const admin = getSupabaseAdminClient();
  if (!admin) return undefined;

  const { data, error } = await admin
    .from("market_snapshot")
    .select("key, segment, data")
    .eq("key", key)
    .maybeSingle();
  if (error || !data) return undefined;
  if (data.segment !== SEGMENT) return undefined;
  const d = data.data as PortfolioYieldSnapshot;
  return typeof d?.yieldPct === "number" || d?.yieldPct === null ? d.yieldPct : undefined;
}

export async function upsertPortfolioYieldPctSnapshot(ticker: string, yieldPct: number | null): Promise<void> {
  const key = keyYieldPct(ticker);
  if (!key) return;
  const admin = getSupabaseAdminClient();
  if (!admin) return;

  await admin.from("market_snapshot").upsert(
    {
      key,
      segment: SEGMENT,
      data: { yieldPct } satisfies PortfolioYieldSnapshot,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "key" },
  );
}

export async function readPortfolioInceptionOpenSnapshot(
  ticker: string,
  inceptionYmd: string,
): Promise<number | null | undefined> {
  const key = keyInceptionOpen(ticker, inceptionYmd);
  if (!key || !marketSnapshotReadEnabled()) return undefined;
  const admin = getSupabaseAdminClient();
  if (!admin) return undefined;

  const { data, error } = await admin
    .from("market_snapshot")
    .select("key, segment, data")
    .eq("key", key)
    .maybeSingle();
  if (error || !data) return undefined;
  if (data.segment !== SEGMENT) return undefined;
  const d = data.data as PortfolioInceptionOpenSnapshot;
  return typeof d?.open === "number" || d?.open === null ? d.open : undefined;
}

export async function upsertPortfolioInceptionOpenSnapshot(
  ticker: string,
  inceptionYmd: string,
  open: number | null,
): Promise<void> {
  const key = keyInceptionOpen(ticker, inceptionYmd);
  if (!key) return;
  const admin = getSupabaseAdminClient();
  if (!admin) return;

  await admin.from("market_snapshot").upsert(
    {
      key,
      segment: SEGMENT,
      data: { open } satisfies PortfolioInceptionOpenSnapshot,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "key" },
  );
}

