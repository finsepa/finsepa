import { formatUsdCompact } from "@/lib/market/key-stats-basic-format";

export type EarningsNotificationPayload = {
  ticker: string;
  companyName?: string;
  logoUrl?: string;
  fiscalPeriodLabel: string;
  fiscalPeriodEndYmd?: string | null;
  reportDateYmd?: string | null;
  epsActual?: number | null;
  epsEstimate?: number | null;
  surprisePct?: number | null;
  revenueActual?: number | null;
  revenueEstimate?: number | null;
  revenueSurprisePct?: number | null;
  href?: string;
};

function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim()) {
    const n = Number(v.replace(/,/g, ""));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function str(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

export function quarterLabelFromPeriodEndYmd(ymd: string): string {
  const [, ms] = ymd.split("-");
  const m = Number(ms);
  if (!Number.isFinite(m)) return ymd;
  const y = ymd.slice(0, 4);
  return `Q${Math.ceil(m / 3)} · ${y}`;
}

/** Always render fiscal period as `Q2 · 2026` (middle dot), including legacy `Q2 2026` rows. */
export function formatPeriodLabelForDisplay(
  label: string | null | undefined,
  fiscalPeriodEndYmd?: string | null,
): string {
  if (fiscalPeriodEndYmd) return quarterLabelFromPeriodEndYmd(fiscalPeriodEndYmd);
  const raw = label?.trim() ?? "";
  if (!raw) return "";
  const match = raw.match(/^Q([1-4])\s*(?:[·•.]|\s)\s*(\d{4})$/i);
  if (match) return `Q${match[1]} · ${match[2]}`;
  return raw;
}

/** Listing symbol for notification UI — row, payload, or legacy `AAPL reported earnings` title. */
export function resolveNotificationTicker(input: {
  ticker?: string | null;
  title?: string | null;
  payload?: Record<string, unknown> | null;
}): string {
  const row = input.ticker?.trim();
  if (row) return row.toUpperCase();

  const payload = input.payload;
  if (payload && typeof payload.ticker === "string" && payload.ticker.trim()) {
    return payload.ticker.trim().toUpperCase();
  }

  const title = input.title?.trim() ?? "";
  const legacy = title.match(/^([A-Z][A-Z0-9.-]{0,11})\s+reported\s+earnings$/i);
  if (legacy?.[1]) return legacy[1].toUpperCase();

  return "";
}

export function parseEarningsNotificationPayload(
  payload: Record<string, unknown> | null | undefined,
): EarningsNotificationPayload | null {
  if (!payload || typeof payload !== "object") return null;
  const ticker = str(payload.ticker);
  const fiscalPeriodLabel = str(payload.fiscalPeriodLabel);
  if (!ticker || !fiscalPeriodLabel) return null;
  return {
    ticker,
    companyName: str(payload.companyName) ?? undefined,
    logoUrl: str(payload.logoUrl) ?? undefined,
    fiscalPeriodLabel,
    fiscalPeriodEndYmd: str(payload.fiscalPeriodEndYmd),
    reportDateYmd: str(payload.reportDateYmd),
    epsActual: num(payload.epsActual),
    epsEstimate: num(payload.epsEstimate),
    surprisePct: num(payload.surprisePct),
    revenueActual: num(payload.revenueActual),
    revenueEstimate: num(payload.revenueEstimate),
    revenueSurprisePct: num(payload.revenueSurprisePct),
    href: str(payload.href) ?? undefined,
  };
}

function formatEpsUsd(n: number): string {
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatSurprisePct(pct: number | null | undefined): string | null {
  if (pct == null || !Number.isFinite(pct)) return null;
  const sign = pct > 0 ? "+" : "";
  return `(${sign}${pct.toFixed(1)}%)`;
}

export function surpriseToneClass(pct: number | null | undefined): string {
  if (pct == null || !Number.isFinite(pct) || pct === 0) return "text-[#71717A]";
  return pct > 0 ? "text-[#16A34A]" : "text-[#DC2626]";
}

export type EarningsMetricLine = {
  label: string;
  actualDisplay: string;
  estimateDisplay: string | null;
  surpriseDisplay: string | null;
  surprisePct: number | null;
};

export function buildEarningsMetricLine(args: {
  label: string;
  actual: number | null | undefined;
  estimate: number | null | undefined;
  surprisePct: number | null | undefined;
  formatValue: (n: number) => string;
}): EarningsMetricLine | null {
  if (args.actual == null || !Number.isFinite(args.actual)) return null;
  const actualDisplay = args.formatValue(args.actual);
  const estimateDisplay =
    args.estimate != null && Number.isFinite(args.estimate) ? args.formatValue(args.estimate) : null;
  let surprisePct = args.surprisePct ?? null;
  if (
    surprisePct == null &&
    estimateDisplay != null &&
    args.estimate != null &&
    args.estimate !== 0
  ) {
    surprisePct = ((args.actual - args.estimate) / Math.abs(args.estimate)) * 100;
  }
  return {
    label: args.label,
    actualDisplay,
    estimateDisplay,
    surpriseDisplay: formatSurprisePct(surprisePct),
    surprisePct,
  };
}

export function earningsMetricLinesFromPayload(
  payload: EarningsNotificationPayload,
): EarningsMetricLine[] {
  const lines: EarningsMetricLine[] = [];
  const eps = buildEarningsMetricLine({
    label: "EPS",
    actual: payload.epsActual,
    estimate: payload.epsEstimate,
    surprisePct: payload.surprisePct,
    formatValue: formatEpsUsd,
  });
  if (eps) lines.push(eps);

  const revenue = buildEarningsMetricLine({
    label: "Revenue",
    actual: payload.revenueActual,
    estimate: payload.revenueEstimate,
    surprisePct: payload.revenueSurprisePct,
    formatValue: formatUsdCompact,
  });
  if (revenue) lines.push(revenue);

  return lines;
}

export function formatNotificationTimestamp(iso: string): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "";
  return new Date(t).toLocaleString("en-US", {
    weekday: "long",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}
