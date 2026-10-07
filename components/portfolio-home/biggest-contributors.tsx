"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { usePlanAccessOptional } from "@/components/account/plan-access-provider";
import { ProFeatureBadge } from "@/components/account/pro-feature-badge";
import { MOBILE_ELEVATED_CARD_CLASS, STOCK_OVERVIEW_SECTION_HEADING_CLASS } from "@/components/design-system/card-surface-styles";
import { SegmentedControl } from "@/components/design-system/segmented-control";
import type { PortfolioHolding, PortfolioTransaction } from "@/components/portfolio/portfolio-types";
import { ChangeCaretIcon } from "@/components/screener/change-pct";
import { CompanyLogo } from "@/components/screener/company-logo";
import { PATH_ACCOUNT_PLANS } from "@/lib/auth/routes";
import { portfolioHoldingAssetHref } from "@/lib/crypto/crypto-picker-universe";
import { TrendingDown, TrendingUp } from "@/lib/icons";
import { formatSignedUsdAmountGrouped2dp } from "@/lib/market/key-stats-basic-format";
import { normalizeUsdForDisplay } from "@/lib/portfolio/overview-metrics";
import { portfolioAssetSymbolCaption } from "@/lib/portfolio/custom-asset-symbol";
import { displayLogoUrlForPortfolioSymbol } from "@/lib/portfolio/portfolio-asset-display-logo";
import { cn } from "@/lib/utils";
import type { WatchlistEnrichedItem } from "@/lib/watchlist/enriched-types";
import { fetchWatchlistEnriched } from "@/lib/watchlist/fetch-watchlist-enriched";
import { normalizeWatchlistStorageKey } from "@/lib/watchlist/normalize-storage-key";

const MAX_PER_COLUMN = 5;
/** Trades this recent may fall inside the server's 7-day window (client/server clocks differ by timezone). */
const TRADE_SYMBOL_LOOKBACK_DAYS = 8;

type ContributorPeriod = "1d" | "7d";

const PERIOD_OPTIONS: { value: ContributorPeriod; label: string }[] = [
  { value: "1d", label: "1D" },
  { value: "7d", label: "7D" },
];

type Contributor = {
  symbol: string;
  name: string;
  logoUrl: string;
  href: string | null;
  gainUsd: number;
  gainPct: number | null;
};

type PeriodStartCloses = {
  closes: Record<string, number | null>;
  startYmds: Record<string, string>;
  /** 1D only — values held shares at the live quote instead of the holding's stored value. */
  livePrices?: Record<string, number>;
};

function normSymbol(s: string): string {
  return s.trim().toUpperCase();
}

function isTrade(t: PortfolioTransaction): boolean {
  return t.kind === "trade" && Boolean(normSymbol(t.symbol));
}

function recentTradeCutoffYmd(): string {
  const d = new Date();
  d.setDate(d.getDate() - TRADE_SYMBOL_LOOKBACK_DAYS);
  return d.toISOString().slice(0, 10);
}

function yesterdayLocalYmd(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

/**
 * 1D start = previous close implied by the live quote (`price / (1 + pct1d)`), same as iOS. While the
 * market is closed this still reflects the last session's move rather than collapsing to zero.
 */
async function fetchDayQuotes(symbols: string[]): Promise<PeriodStartCloses> {
  const { stocks, crypto, indices } = await fetchWatchlistEnriched(
    `home-contributors:${symbols.join(",")}`,
    symbols,
  );
  const byKey = new Map<string, WatchlistEnrichedItem>();
  for (const row of [...stocks, ...crypto, ...indices]) {
    byKey.set(normalizeWatchlistStorageKey(row.storageKey || row.symbol), row);
  }
  const startYmd = yesterdayLocalYmd();
  const closes: Record<string, number | null> = {};
  const startYmds: Record<string, string> = {};
  const livePrices: Record<string, number> = {};
  for (const symbol of symbols) {
    startYmds[symbol] = startYmd;
    const row = byKey.get(normalizeWatchlistStorageKey(symbol));
    const price = row?.price;
    if (price == null || !Number.isFinite(price) || price <= 0) continue;
    livePrices[symbol] = price;
    const pct = row?.pct1d;
    if (pct != null && Number.isFinite(pct) && pct > -100) closes[symbol] = price / (1 + pct / 100);
  }
  return { closes, startYmds, livePrices };
}

/** Results per `period|symbols` key, so flipping 1D ↔ 7D doesn't refetch. */
function usePeriodStartCloses(symbolsKey: string, period: ContributorPeriod, enabled: boolean) {
  const [fetched, setFetched] = useState<Record<string, PeriodStartCloses | null>>({});
  const key = `${period}|${symbolsKey}`;
  const has = Object.hasOwn(fetched, key);

  useEffect(() => {
    if (!enabled || !symbolsKey || has) return;
    let cancelled = false;
    void (async () => {
      let data: PeriodStartCloses | null = null;
      try {
        if (period === "1d") {
          data = await fetchDayQuotes(symbolsKey.split(","));
        } else {
          const res = await fetch("/api/portfolio/week-start-closes", {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ symbols: symbolsKey.split(","), period }),
          });
          if (res.ok) data = (await res.json()) as PeriodStartCloses;
        }
      } catch {
        // show the empty state
      }
      if (!cancelled) setFetched((prev) => ({ ...prev, [key]: data }));
    })();
    return () => {
      cancelled = true;
    };
  }, [enabled, symbolsKey, period, key, has]);

  return {
    data: has ? fetched[key]! : null,
    loading: enabled && symbolsKey !== "" && !has,
  };
}

/**
 * P/L per ticker over the period: value now − (shares held at the start × start close) − net cash put in
 * by trades since. Covers positions opened, added to, trimmed, or closed within the period.
 */
function buildContributors(
  holdings: PortfolioHolding[],
  transactions: PortfolioTransaction[],
  data: PeriodStartCloses,
): Contributor[] {
  type Acc = {
    /** Stored symbols merged into this row (`BTC` and `BTC-USD` are the same asset). */
    symbols: string[];
    name: string;
    sharesNow: number;
    valueNow: number;
    netSharesInWeek: number;
    netCashInWeek: number;
    buyCostInWeek: number;
  };
  const bySymbol = new Map<string, Acc>();
  const acc = (symbol: string, name: string): Acc => {
    const key = portfolioAssetSymbolCaption(symbol);
    let a = bySymbol.get(key);
    if (!a) {
      a = {
        symbols: [],
        name: name.trim() || key,
        sharesNow: 0,
        valueNow: 0,
        netSharesInWeek: 0,
        netCashInWeek: 0,
        buyCostInWeek: 0,
      };
      bySymbol.set(key, a);
    }
    if (!a.symbols.includes(symbol)) a.symbols.push(symbol);
    return a;
  };

  for (const h of holdings) {
    const symbol = normSymbol(h.symbol);
    if (!symbol || symbol === "USD") continue;
    const a = acc(symbol, h.name);
    a.sharesNow += h.shares;
    a.valueNow += h.currentValue;
  }

  for (const t of transactions) {
    if (!isTrade(t)) continue;
    const startYmd = data.startYmds[normSymbol(t.symbol)];
    if (!startYmd || t.date <= startYmd) continue;
    const op = t.operation.trim().toLowerCase();
    if (op !== "buy" && op !== "sell") continue;
    const shares = Math.abs(t.shares);
    const notional = shares * t.price;
    const fee = Math.max(0, t.fee || 0);
    const a = acc(normSymbol(t.symbol), t.name);
    if (op === "buy") {
      a.netSharesInWeek += shares;
      a.netCashInWeek += notional + fee;
      a.buyCostInWeek += notional + fee;
    } else {
      a.netSharesInWeek -= shares;
      a.netCashInWeek -= notional - fee;
    }
  }

  const out: Contributor[] = [];
  for (const [displaySymbol, a] of bySymbol) {
    const symbol = a.symbols[0]!;
    const sharesStart = Math.max(0, a.sharesNow - a.netSharesInWeek);
    const closeStart = a.symbols.map((s) => data.closes[s]).find((c) => c != null) ?? null;
    if (sharesStart > 0 && closeStart == null) continue;
    const startValue = sharesStart * (closeStart ?? 0);
    const livePrice = a.symbols.map((s) => data.livePrices?.[s]).find((p) => p != null);
    const valueNow = livePrice != null ? a.sharesNow * livePrice : a.valueNow;
    const gainUsd = normalizeUsdForDisplay(valueNow - startValue - a.netCashInWeek);
    const base = startValue + a.buyCostInWeek;
    out.push({
      symbol: displaySymbol,
      name: a.name,
      logoUrl: displayLogoUrlForPortfolioSymbol(symbol),
      href: portfolioHoldingAssetHref(symbol),
      gainUsd,
      gainPct: base > 0 ? (gainUsd / base) * 100 : null,
    });
  }
  return out;
}

function ContributorRow({ row }: { row: Contributor }) {
  const positive = row.gainUsd >= 0;
  const content = (
    <>
      <span className="flex min-w-0 flex-1 items-center gap-3">
        <CompanyLogo name={row.name} logoUrl={row.logoUrl} symbol={row.symbol} size="md" />
        <span className="min-w-0">
          <span className="block truncate text-[14px] font-semibold leading-5 text-fg">{row.symbol}</span>
          <span className="block truncate text-[12px] font-normal leading-4 text-fg-muted">{row.name}</span>
        </span>
      </span>
      <span
        className={cn(
          "flex shrink-0 flex-col items-end gap-0.5 tabular-nums",
          positive ? "text-up" : "text-down",
        )}
      >
        <span className="text-[14px] font-medium leading-5">{formatSignedUsdAmountGrouped2dp(row.gainUsd)}</span>
        {row.gainPct != null && Number.isFinite(row.gainPct) ? (
          <span className="inline-flex items-center gap-0.5 text-[12px] font-medium leading-4">
            <ChangeCaretIcon direction={positive ? "up" : "down"} size={11} />
            {Math.abs(row.gainPct).toFixed(2)}%
          </span>
        ) : null}
      </span>
    </>
  );
  const rowClass = "flex items-center gap-3 rounded-[10px] px-2 py-2";
  return row.href ? (
    <Link href={row.href} className={cn(rowClass, "transition-colors hover:bg-surface-muted/60")}>
      {content}
    </Link>
  ) : (
    <div className={rowClass}>{content}</div>
  );
}

function ContributorColumn({
  title,
  rows,
  emptyLabel,
  emptyIcon: EmptyIcon,
  locked = false,
}: {
  title: string;
  rows: Contributor[];
  emptyLabel: string;
  emptyIcon: typeof TrendingUp;
  /** Free plan — rows stay in place but blurred and non-interactive. */
  locked?: boolean;
}) {
  return (
    <div className={cn("flex min-w-0 flex-col p-2", MOBILE_ELEVATED_CARD_CLASS)}>
      <h3 className="px-2 pb-1 pt-1 text-[13px] font-medium leading-5 text-fg-muted">{title}</h3>
      <div className="relative">
        <div
          className={locked ? "select-none" : undefined}
          style={locked ? { filter: "blur(6px)" } : undefined}
          inert={locked}
          aria-hidden={locked || undefined}
        >
          {rows.length === 0 ? (
            <div className="flex items-center gap-3 px-2 py-2">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] border border-stroke-muted bg-surface-muted text-fg-muted">
                <EmptyIcon className="size-4" strokeWidth={2} aria-hidden />
              </span>
              <p className="min-w-0 text-[13px] leading-5 text-fg-muted">{emptyLabel}</p>
            </div>
          ) : (
            <ul className="m-0 flex list-none flex-col p-0">
              {rows.map((r) => (
                <li key={r.symbol}>
                  <ContributorRow row={r} />
                </li>
              ))}
            </ul>
          )}
        </div>
        {locked ? (
          <Link
            href={PATH_ACCOUNT_PLANS}
            aria-label="View Pro plans"
            className="absolute inset-0 rounded-[10px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fg/15"
          />
        ) : null}
      </div>
    </div>
  );
}

function ContributorColumnSkeleton({ title }: { title: string }) {
  return (
    <div className={cn("flex min-w-0 flex-col p-2", MOBILE_ELEVATED_CARD_CLASS)} aria-hidden>
      <h3 className="px-2 pb-1 pt-1 text-[13px] font-medium leading-5 text-fg-muted">{title}</h3>
      <ul className="m-0 flex list-none flex-col p-0">
        {Array.from({ length: MAX_PER_COLUMN }).map((_, i) => (
          <li key={i} className="flex items-center gap-3 px-2 py-2">
            <div className="h-8 w-8 shrink-0 animate-pulse rounded-[10px] bg-stroke" />
            <div className="min-w-0 flex-1 space-y-1.5">
              <div className="h-3.5 w-12 animate-pulse rounded bg-stroke" />
              <div className="h-3 w-28 max-w-full animate-pulse rounded bg-stroke" />
            </div>
            <div className="flex shrink-0 flex-col items-end space-y-1.5">
              <div className="h-3.5 w-16 animate-pulse rounded bg-stroke" />
              <div className="h-3 w-11 animate-pulse rounded bg-stroke" />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Home — top winners and losers over 1D / 7D across the user's (non-combined) portfolios.
 */
export function BiggestContributors({
  holdings,
  transactions,
  ready,
}: {
  holdings: PortfolioHolding[];
  transactions: PortfolioTransaction[];
  ready: boolean;
}) {
  const plan = usePlanAccessOptional();
  const proGate = plan?.isPro !== true;

  const portfolioSymbolsKey = useMemo(() => {
    const cutoff = recentTradeCutoffYmd();
    const set = new Set<string>();
    for (const h of holdings) {
      const s = normSymbol(h.symbol);
      if (s && s !== "USD") set.add(s);
    }
    for (const t of transactions) {
      if (isTrade(t) && t.date >= cutoff) set.add(normSymbol(t.symbol));
    }
    return [...set].sort().join(",");
  }, [holdings, transactions]);

  const [period, setPeriod] = useState<ContributorPeriod>("1d");
  const portfolioCloses = usePeriodStartCloses(portfolioSymbolsKey, period, ready);
  const loading = !ready || portfolioCloses.loading;

  const { winners, losers } = useMemo(() => {
    const all = portfolioCloses.data ? buildContributors(holdings, transactions, portfolioCloses.data) : [];
    return {
      winners: all
        .filter((c) => c.gainUsd > 0)
        .sort((a, b) => b.gainUsd - a.gainUsd)
        .slice(0, MAX_PER_COLUMN),
      losers: all
        .filter((c) => c.gainUsd < 0)
        .sort((a, b) => a.gainUsd - b.gainUsd)
        .slice(0, MAX_PER_COLUMN),
    };
  }, [portfolioCloses.data, holdings, transactions]);

  if (ready && portfolioSymbolsKey === "") return null;

  return (
    <section aria-label="Biggest contributors" className="min-w-0">
      <div className="mb-5 flex min-w-0 items-center gap-2">
        <h2 className={STOCK_OVERVIEW_SECTION_HEADING_CLASS}>Biggest contributors</h2>
        {proGate ? <ProFeatureBadge /> : null}
        <SegmentedControl
          aria-label="Contributors period"
          options={PERIOD_OPTIONS}
          value={period}
          onChange={setPeriod}
          size="sm"
          className="ml-auto shrink-0"
        />
      </div>
      {loading ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <ContributorColumnSkeleton title="Winners" />
          <ContributorColumnSkeleton title="Losers" />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <ContributorColumn
            title="Winners"
            rows={winners}
            emptyLabel={period === "1d" ? "No gains today." : "No gains this week."}
            emptyIcon={TrendingUp}
            locked={proGate}
          />
          <ContributorColumn
            title="Losers"
            rows={losers}
            emptyLabel={period === "1d" ? "No losses today." : "No losses this week."}
            emptyIcon={TrendingDown}
            locked={proGate}
          />
        </div>
      )}
    </section>
  );
}
