import "server-only";

import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  countVaultReports,
  EARNINGS_IR_VAULT_START_YMD,
  isIrVaultAllowedUrl,
  isIrVaultPeriodInScope,
  pairDistinctVaultDocs,
  vaultTrafficLight,
  type EarningsIrVaultQuarterReport,
  type EarningsIrVaultRow,
  type EarningsIrVaultTickerReport,
} from "@/lib/market/earnings-ir-vault-types";
import { earningsDeckLookupLabels } from "@/lib/market/earnings-deck-quarter-labels";
import { earningsPdfHrefMatchesQuarterLabels } from "@/lib/market/gcs-web-earnings-presentations";
import type { StockEarningsHistoryRow } from "@/lib/market/stock-earnings-types";

export { isIrVaultAllowedUrl } from "@/lib/market/earnings-ir-vault-types";

function normalizeTicker(ticker: string): string {
  return ticker.trim().toUpperCase();
}

function cacheKey(ticker: string, fiscalPeriodEndYmd: string): string {
  return `${normalizeTicker(ticker)}|${fiscalPeriodEndYmd}`;
}

export async function loadEarningsIrVaultForTicker(
  ticker: string,
): Promise<Map<string, EarningsIrVaultRow>> {
  const out = new Map<string, EarningsIrVaultRow>();
  const admin = getSupabaseAdminClient();
  if (!admin) return out;

  const sym = normalizeTicker(ticker);
  const { data, error } = await admin
    .from("earnings_ir_vault")
    .select(
      "ticker,fiscal_period_end,fiscal_period_label,report_date,slides_url,filings_url,slides_locked,filings_locked,ir_website,resolution_note,verified_at,updated_at",
    )
    .eq("ticker", sym);

  if (error) {
    console.warn(`earnings_ir_vault_load_failed: ${error.message}`);
    return out;
  }

  for (const row of data ?? []) {
    const t = typeof row.ticker === "string" ? row.ticker : "";
    const fiscal = typeof row.fiscal_period_end === "string" ? row.fiscal_period_end : "";
    if (!t || !fiscal) continue;
    out.set(cacheKey(t, fiscal), row as EarningsIrVaultRow);
  }
  return out;
}

export async function loadEarningsIrVaultForTickers(
  tickers: readonly string[],
): Promise<EarningsIrVaultRow[]> {
  const admin = getSupabaseAdminClient();
  if (!admin || tickers.length === 0) return [];

  const syms = [...new Set(tickers.map(normalizeTicker).filter(Boolean))];
  const { data, error } = await admin
    .from("earnings_ir_vault")
    .select(
      "ticker,fiscal_period_end,fiscal_period_label,report_date,slides_url,filings_url,slides_locked,filings_locked,ir_website,resolution_note,verified_at,updated_at",
    )
    .in("ticker", syms)
    .gte("fiscal_period_end", EARNINGS_IR_VAULT_START_YMD)
    .order("ticker", { ascending: true })
    .order("fiscal_period_end", { ascending: false });

  if (error) {
    console.warn(`earnings_ir_vault_bulk_load_failed: ${error.message}`);
    return [];
  }
  return (data ?? []) as EarningsIrVaultRow[];
}

/**
 * Merge-only upsert: never clear or replace a locked URL.
 * New IR URLs lock that field permanently.
 */
export async function mergeEarningsIrVaultRows(
  rows: readonly {
    ticker: string;
    fiscalPeriodEndYmd: string;
    fiscalPeriodLabel?: string | null;
    reportDateYmd?: string | null;
    slidesUrl?: string | null;
    filingsUrl?: string | null;
    irWebsite?: string | null;
    resolutionNote?: string | null;
  }[],
): Promise<{ written: number }> {
  const admin = getSupabaseAdminClient();
  if (!admin || rows.length === 0) return { written: 0 };

  const now = new Date().toISOString();
  let written = 0;

  for (const incoming of rows) {
    const ticker = normalizeTicker(incoming.ticker);
    const fiscal = incoming.fiscalPeriodEndYmd;
    if (!ticker || !isIrVaultPeriodInScope(fiscal)) continue;

    const distinctIn = pairDistinctVaultDocs(
      isIrVaultAllowedUrl(incoming.slidesUrl) ? incoming.slidesUrl : null,
      isIrVaultAllowedUrl(incoming.filingsUrl) ? incoming.filingsUrl : null,
    );
    let slidesIn = distinctIn.slides;
    let filingsIn = distinctIn.filings;
    const labelAllow = earningsDeckLookupLabels(incoming.fiscalPeriodLabel);
    if (labelAllow.length > 0) {
      if (slidesIn && !earningsPdfHrefMatchesQuarterLabels(slidesIn, labelAllow)) slidesIn = null;
      if (filingsIn && !earningsPdfHrefMatchesQuarterLabels(filingsIn, labelAllow)) filingsIn = null;
    }

    const { data: siblings } = await admin
      .from("earnings_ir_vault")
      .select("slides_url,filings_url")
      .eq("ticker", ticker)
      .neq("fiscal_period_end", fiscal);
    const taken = new Set<string>();
    for (const sib of siblings ?? []) {
      if (typeof sib.slides_url === "string" && sib.slides_url) taken.add(sib.slides_url);
      if (typeof sib.filings_url === "string" && sib.filings_url) taken.add(sib.filings_url);
    }
    if (slidesIn && taken.has(slidesIn)) slidesIn = null;
    if (filingsIn && taken.has(filingsIn)) filingsIn = null;

    const { data: existing } = await admin
      .from("earnings_ir_vault")
      .select(
        "slides_url,filings_url,slides_locked,filings_locked,fiscal_period_label,report_date,ir_website",
      )
      .eq("ticker", ticker)
      .eq("fiscal_period_end", fiscal)
      .maybeSingle();

    const prev = existing as
      | {
          slides_url: string | null;
          filings_url: string | null;
          slides_locked: boolean;
          filings_locked: boolean;
          fiscal_period_label: string | null;
          report_date: string | null;
          ir_website: string | null;
        }
      | null;

    let slidesUrl = prev?.slides_url ?? null;
    let filingsUrl = prev?.filings_url ?? null;
    let slidesLocked = Boolean(prev?.slides_locked);
    let filingsLocked = Boolean(prev?.filings_locked);

    if (!slidesLocked && slidesIn) {
      slidesUrl = slidesIn;
      slidesLocked = true;
    }
    if (!filingsLocked && filingsIn && filingsIn !== slidesUrl) {
      filingsUrl = filingsIn;
      filingsLocked = true;
    }
    if (slidesUrl && filingsUrl && slidesUrl === filingsUrl) {
      filingsUrl = null;
      filingsLocked = false;
    }

    // Always ensure a row exists for checklist coverage (even if still empty).
    const payload = {
      ticker,
      fiscal_period_end: fiscal,
      fiscal_period_label:
        incoming.fiscalPeriodLabel ?? prev?.fiscal_period_label ?? null,
      report_date: incoming.reportDateYmd ?? prev?.report_date ?? null,
      slides_url: slidesUrl,
      filings_url: filingsUrl,
      slides_locked: slidesLocked,
      filings_locked: filingsLocked,
      ir_website: incoming.irWebsite ?? prev?.ir_website ?? null,
      resolution_note: incoming.resolutionNote ?? null,
      verified_at: slidesLocked || filingsLocked ? now : null,
      updated_at: now,
    };

    const { error } = await admin.from("earnings_ir_vault").upsert(payload, {
      onConflict: "ticker,fiscal_period_end",
    });
    if (error) {
      console.warn(`earnings_ir_vault_upsert_failed: ${error.message}`);
      continue;
    }
    written += 1;
  }

  return { written };
}

/** Apply locked IR vault URLs onto history (does not clear existing non-vault URLs when vault empty). */
export function applyEarningsIrVaultToHistory(
  ticker: string,
  history: StockEarningsHistoryRow[],
  vault: ReadonlyMap<string, EarningsIrVaultRow>,
): StockEarningsHistoryRow[] {
  if (vault.size === 0) return history;
  const sym = normalizeTicker(ticker);

  return history.map((row) => {
    const fiscal = row.fiscalPeriodEndYmd;
    if (!fiscal || !isIrVaultPeriodInScope(fiscal)) return row;
    const hit = vault.get(cacheKey(sym, fiscal));
    if (!hit) return row;

    const slides =
      hit.slides_locked && isIrVaultAllowedUrl(hit.slides_url) ? hit.slides_url : row.secSlidesUrl;
    const filings =
      hit.filings_locked && isIrVaultAllowedUrl(hit.filings_url) ? hit.filings_url : row.secFilingsUrl;

    if (slides === row.secSlidesUrl && filings === row.secFilingsUrl) return row;
    return { ...row, secSlidesUrl: slides, secFilingsUrl: filings };
  });
}

export function buildIrVaultTickerReport(
  ticker: string,
  rows: readonly EarningsIrVaultRow[],
  expectedQuarters: readonly {
    fiscalPeriodEndYmd: string;
    fiscalPeriodLabel: string | null;
    reportDateYmd: string | null;
  }[],
): EarningsIrVaultTickerReport {
  const sym = normalizeTicker(ticker);
  const byFiscal = new Map(
    rows.filter((r) => r.ticker === sym).map((r) => [r.fiscal_period_end, r]),
  );

  const quarters: EarningsIrVaultQuarterReport[] = expectedQuarters
    .filter((q) => isIrVaultPeriodInScope(q.fiscalPeriodEndYmd))
    .map((q) => {
      const hit = byFiscal.get(q.fiscalPeriodEndYmd);
      const slidesUrl =
        hit?.slides_locked && isIrVaultAllowedUrl(hit.slides_url) ? hit.slides_url : null;
      const filingsUrl =
        hit?.filings_locked && isIrVaultAllowedUrl(hit.filings_url) ? hit.filings_url : null;
      const reportCount = countVaultReports(slidesUrl, filingsUrl);
      return {
        ticker: sym,
        fiscalPeriodEndYmd: q.fiscalPeriodEndYmd,
        fiscalPeriodLabel: hit?.fiscal_period_label ?? q.fiscalPeriodLabel,
        reportDateYmd: hit?.report_date ?? q.reportDateYmd,
        slidesUrl,
        filingsUrl,
        slidesStatus: slidesUrl ? ("locked" as const) : ("missing" as const),
        filingsStatus: filingsUrl ? ("locked" as const) : ("missing" as const),
        reportCount,
        trafficLight: vaultTrafficLight(reportCount),
      };
    });

  const green = quarters.filter((q) => q.trafficLight === "green").length;
  const yellow = quarters.filter((q) => q.trafficLight === "yellow").length;
  const red = quarters.filter((q) => q.trafficLight === "red").length;
  const tickerLight =
    red === 0 && yellow === 0 && green > 0
      ? ("green" as const)
      : green + yellow > 0
        ? ("yellow" as const)
        : ("red" as const);

  return {
    ticker: sym,
    irWebsite: rows.find((r) => r.ticker === sym)?.ir_website ?? null,
    quarters,
    green,
    yellow,
    red,
    trafficLight: tickerLight,
  };
}
