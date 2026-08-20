import type { ScreenerKeyStatMetricDef } from "@/lib/screener/screener-key-stats-metric-catalog";
import { getScreenerKeyStatMetricById } from "@/lib/screener/screener-key-stats-metric-catalog";

export const SCREENER_COMPANIES_KEY_STAT_MAX_TICKERS = 20;
export const SCREENER_COMPANIES_KEY_STAT_MAX_METRIC_IDS = 30;

export type ParsedScreenerCompaniesKeyStatRequest =
  | { mode: "batch"; tickers: string[]; metrics: ScreenerKeyStatMetricDef[]; metricIds: string[] }
  | { mode: "legacy"; tickers: string[]; metric: ScreenerKeyStatMetricDef };

function normalizeTickers(raw: unknown): string[] | null {
  if (!Array.isArray(raw)) return null;
  return [
    ...new Set(
      raw
        .filter((t): t is string => typeof t === "string" && t.trim().length > 0)
        .map((t) => t.trim().toUpperCase()),
    ),
  ].slice(0, SCREENER_COMPANIES_KEY_STAT_MAX_TICKERS);
}

function normalizeMetricIds(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return [
    ...new Set(
      raw
        .filter((id): id is string => typeof id === "string" && id.trim().length > 0)
        .map((id) => id.trim()),
    ),
  ].slice(0, SCREENER_COMPANIES_KEY_STAT_MAX_METRIC_IDS);
}

export function parseScreenerCompaniesKeyStatRequest(
  body: unknown,
): { ok: true; parsed: ParsedScreenerCompaniesKeyStatRequest } | { ok: false; error: string; status: number } {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "Invalid JSON body", status: 400 };
  }

  const record = body as Record<string, unknown>;
  const tickers = normalizeTickers(record.tickers);
  if (!tickers) {
    return { ok: false, error: "tickers must be an array", status: 400 };
  }

  if (Array.isArray(record.metricIds)) {
    const metricIds = normalizeMetricIds(record.metricIds);
    if (!metricIds.length) {
      return { ok: false, error: "metricIds must be a non-empty array", status: 400 };
    }
    const metrics: ScreenerKeyStatMetricDef[] = [];
    for (const id of metricIds) {
      const metric = getScreenerKeyStatMetricById(id);
      if (!metric) return { ok: false, error: `Unknown metricId: ${id}`, status: 400 };
      metrics.push(metric);
    }
    return { ok: true, parsed: { mode: "batch", tickers, metrics, metricIds } };
  }

  const metricIdRaw = record.metricId;
  if (typeof metricIdRaw !== "string" || !metricIdRaw.trim()) {
    return { ok: false, error: "metricId or metricIds required", status: 400 };
  }
  const metric = getScreenerKeyStatMetricById(metricIdRaw.trim());
  if (!metric) return { ok: false, error: "Unknown metricId", status: 400 };

  return { ok: true, parsed: { mode: "legacy", tickers, metric } };
}
