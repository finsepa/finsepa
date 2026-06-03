import "server-only";

import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { marketSnapshotReadEnabled } from "@/lib/market/market-snapshot-store";
import type { EodhdDividendCalendarRow } from "@/lib/market/eodhd-dividends-calendar";
import type { EodhdDividendRow } from "@/lib/market/eodhd-splits-dividends";

const SEGMENT = "portfolio_dividends_inputs_v1";
const YMD = /^\d{4}-\d{2}-\d{2}$/;

export type PortfolioDividendsInputsSnapshot = {
  calendar: EodhdDividendCalendarRow[];
  history: EodhdDividendRow[];
  yieldPct: number | null;
};

function keyFor(
  ticker: string,
  paymentFromYmd: string,
  historyFromYmd: string,
  calendarToYmd: string,
): string | null {
  const t = ticker.trim().toUpperCase();
  if (!t || !YMD.test(paymentFromYmd) || !YMD.test(historyFromYmd) || !YMD.test(calendarToYmd)) {
    return null;
  }
  return `portfolio_ddiv_inputs_${t}_${paymentFromYmd}_${historyFromYmd}_${calendarToYmd}`;
}

function parseSnapshotData(raw: unknown): PortfolioDividendsInputsSnapshot | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const o = raw as Record<string, unknown>;
  const calendar = o.calendar;
  const history = o.history;
  if (!Array.isArray(calendar) || !Array.isArray(history)) return undefined;
  const yieldPct = o.yieldPct;
  if (yieldPct !== null && (typeof yieldPct !== "number" || !Number.isFinite(yieldPct))) return undefined;
  return {
    calendar: calendar as EodhdDividendCalendarRow[],
    history: history as EodhdDividendRow[],
    yieldPct,
  };
}

export async function readPortfolioDividendsInputsSnapshot(
  ticker: string,
  paymentFromYmd: string,
  historyFromYmd: string,
  calendarToYmd: string,
): Promise<PortfolioDividendsInputsSnapshot | undefined> {
  const key = keyFor(ticker, paymentFromYmd, historyFromYmd, calendarToYmd);
  if (!key || !marketSnapshotReadEnabled()) return undefined;
  const admin = getSupabaseAdminClient();
  if (!admin) return undefined;

  const { data, error } = await admin.from("market_snapshot").select("key, segment, data").eq("key", key).maybeSingle();
  if (error || !data) return undefined;
  if (data.segment !== SEGMENT) return undefined;
  return parseSnapshotData(data.data);
}

export async function upsertPortfolioDividendsInputsSnapshot(
  ticker: string,
  paymentFromYmd: string,
  historyFromYmd: string,
  calendarToYmd: string,
  payload: PortfolioDividendsInputsSnapshot,
): Promise<void> {
  const key = keyFor(ticker, paymentFromYmd, historyFromYmd, calendarToYmd);
  if (!key) return;
  const admin = getSupabaseAdminClient();
  if (!admin) return;

  await admin.from("market_snapshot").upsert(
    {
      key,
      segment: SEGMENT,
      data: payload,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "key" },
  );
}
