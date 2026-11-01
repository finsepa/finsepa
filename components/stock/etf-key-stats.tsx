"use client";

import { STOCK_OVERVIEW_SECTION_TITLE_CLASS } from "@/components/design-system/card-surface-styles";
import { CardSkeleton, KEY_STATS_CARD_CLASS, StatRow } from "@/components/stock/key-stats";
import type { EtfProfile, EtfWeight } from "@/lib/market/etf-profile-types";
import { formatUsdCompact } from "@/lib/market/key-stats-basic-format";
import { useEtfProfile } from "@/lib/market/use-etf-profile";
import { cn } from "@/lib/utils";

type Row = { label: string; value: string; valueClassName?: string };

const DASH = "—";

/** Free-text values (issuer, index) can be long — cap and ellipsize instead of pushing the label out. */
const TEXT_VALUE_CLASS = "max-w-[65%] truncate text-fg";

function pct(n: number | null, digits = 2): string {
  return n == null ? DASH : `${n.toFixed(digits)}%`;
}

function signedPct(n: number | null): Row["value"] {
  if (n == null) return DASH;
  return `${n > 0 ? "+" : ""}${n.toFixed(2)}%`;
}

function toneClass(n: number | null): string | undefined {
  if (n == null || n === 0) return undefined;
  return n > 0 ? "text-up" : "text-down";
}

function usd(n: number | null): string {
  return n == null ? DASH : `$${n.toFixed(2)}`;
}

function formatInception(iso: string | null): string {
  if (!iso) return DASH;
  const d = new Date(`${iso}T12:00:00Z`);
  if (!Number.isFinite(d.getTime())) return iso;
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(d);
}

function weightRows(weights: EtfWeight[]): Row[] {
  return weights.map((w) => ({ label: w.label, value: pct(w.pct) }));
}

/** EODHD caps large funds at 10 listed positions (and reports that as the count), so 10 means "at least 10". */
function holdingsCountLabel(p: EtfProfile): string {
  const n = p.holdingsCount ?? (p.holdings.length || null);
  if (n == null) return DASH;
  return n === 10 && p.holdings.length === 10 ? "10+" : String(n);
}

function fundRows(p: EtfProfile): Row[] {
  return [
    { label: "AUM", value: p.aumUsd != null ? formatUsdCompact(p.aumUsd) : DASH },
    { label: "Expense Ratio", value: pct(p.expenseRatioPct) },
    { label: "Holdings", value: holdingsCountLabel(p) },
    { label: "Category", value: p.category ?? DASH, valueClassName: TEXT_VALUE_CLASS },
    { label: "Index", value: p.indexName ?? DASH, valueClassName: TEXT_VALUE_CLASS },
    { label: "Issuer", value: p.issuer ?? DASH, valueClassName: TEXT_VALUE_CLASS },
    { label: "Inception", value: formatInception(p.inceptionDate) },
  ];
}

function performanceRows(p: EtfProfile): Row[] {
  const r = p.returns;
  return [
    { label: "YTD", value: signedPct(r.ytd), valueClassName: toneClass(r.ytd) },
    { label: "1Y", value: signedPct(r.y1), valueClassName: toneClass(r.y1) },
    { label: "3Y (annualized)", value: signedPct(r.y3), valueClassName: toneClass(r.y3) },
    { label: "5Y (annualized)", value: signedPct(r.y5), valueClassName: toneClass(r.y5) },
    { label: "10Y (annualized)", value: signedPct(r.y10), valueClassName: toneClass(r.y10) },
  ];
}

function riskRows(p: EtfProfile): Row[] {
  return [
    { label: "Beta", value: p.beta != null ? p.beta.toFixed(2) : DASH },
    { label: "Volatility (1Y)", value: pct(p.volatility1y) },
    { label: "Volatility (3Y)", value: pct(p.volatility3y) },
    { label: "52W High", value: usd(p.high52w) },
    { label: "52W Low", value: usd(p.low52w) },
  ];
}

function dividendRows(p: EtfProfile): Row[] {
  return [
    { label: "Yield", value: pct(p.yieldPct) },
    { label: "Frequency", value: p.dividendFrequency ?? DASH },
    { label: "Holdings Turnover", value: pct(p.turnoverPct) },
  ];
}

const CARDS: { title: string; rows: (p: EtfProfile) => Row[]; skeleton: string[] }[] = [
  { title: "Fund", rows: fundRows, skeleton: ["AUM", "Expense Ratio", "Holdings", "Category", "Index", "Issuer", "Inception"] },
  { title: "Performance", rows: performanceRows, skeleton: ["YTD", "1Y", "3Y", "5Y", "10Y"] },
  { title: "Risk", rows: riskRows, skeleton: ["Beta", "Volatility (1Y)", "Volatility (3Y)", "52W High", "52W Low"] },
  { title: "Dividends", rows: dividendRows, skeleton: ["Yield", "Frequency", "Holdings Turnover"] },
  { title: "Asset Allocation", rows: (p) => weightRows(p.assetAllocation), skeleton: ["US Stocks", "Non-US Stocks", "Cash"] },
  { title: "Market Cap", rows: (p) => weightRows(p.marketCap), skeleton: ["Mega", "Big", "Medium", "Small"] },
];

/** ETF overview key stats — same card + row chrome as stock key stats, fed by EODHD `ETF_Data`. */
export function EtfKeyStats({ ticker }: { ticker: string }) {
  const { profile, loading } = useEtfProfile(ticker);
  if (!loading && !profile) return null;

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
      {CARDS.map((card) => {
        const rows = profile ? card.rows(profile) : [];
        return (
          <div key={card.title} className={KEY_STATS_CARD_CLASS}>
            <h3 className={cn("mb-2", STOCK_OVERVIEW_SECTION_TITLE_CLASS)}>{card.title}</h3>
            {loading ? (
              <CardSkeleton rowLabels={card.skeleton} />
            ) : rows.length ? (
              rows.map((row) => (
                <StatRow key={row.label} label={row.label} value={row.value} valueClassName={row.valueClassName} />
              ))
            ) : (
              <p className="py-1.5 text-[14px] leading-5 text-fg-muted">Not available</p>
            )}
          </div>
        );
      })}
    </div>
  );
}
