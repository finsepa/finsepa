"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { usePlanAccessOptional } from "@/components/account/plan-access-provider";
import { ProFeatureBadge } from "@/components/account/pro-feature-badge";
import { MOBILE_ELEVATED_CARD_CLASS, STOCK_OVERVIEW_SECTION_HEADING_CLASS } from "@/components/design-system/card-surface-styles";
import type { PortfolioHolding, PortfolioTransaction } from "@/components/portfolio/portfolio-types";
import { ChangeCaretIcon } from "@/components/screener/change-pct";
import { CompanyLogo } from "@/components/screener/company-logo";
import { PATH_ACCOUNT_PLANS } from "@/lib/auth/routes";
import { portfolioHoldingAssetHref } from "@/lib/crypto/crypto-picker-universe";
import { TrendingDown, TrendingUp } from "@/lib/icons";
import { formatSignedUsdAmountGrouped2dp } from "@/lib/market/key-stats-basic-format";
import { normalizeUsdForDisplay } from "@/lib/portfolio/overview-metrics";
import { displayLogoUrlForPortfolioSymbol } from "@/lib/portfolio/portfolio-asset-display-logo";
import { cn } from "@/lib/utils";
const MAX_PER_COLUMN = 5;
/** Trades this recent may fall inside the server's 7-day window (client/server clocks differ by timezone). */
const TRADE_SYMBOL_LOOKBACK_DAYS = 8;

type Contributor = {
  symbol: string;
  name: string;
  logoUrl: string;
  href: string | null;
  gainUsd: number;
  gainPct: number | null;
};

type WeekStartCloses = { weekStartYmd: string; closes: Record<string, number | null> };

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

function useWeekStartCloses(symbolsKey: string, enabled: boolean) {
  const [fetched, setFetched] = useState<{ key: string; data: WeekStartCloses | null } | null>(null);

  useEffect(() => {
    if (!enabled || !symbolsKey) return;
    let cancelled = false;
    void (async () => {
      let data: WeekStartCloses | null = null;
      try {
        const res = await fetch("/api/portfolio/week-start-closes", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ symbols: symbolsKey.split(",") }),
        });
        if (res.ok) data = (await res.json()) as WeekStartCloses;
      } catch {
        // show the empty state
      }
      if (!cancelled) setFetched({ key: symbolsKey, data });
    })();
    return () => {
      cancelled = true;
    };
  }, [enabled, symbolsKey]);

  return {
    data: fetched?.key === symbolsKey ? fetched.data : null,
    loading: enabled && symbolsKey !== "" && fetched?.key !== symbolsKey,
  };
}

/**
 * Weekly P/L per ticker: value now − (shares held a week ago × that week's close) − net cash put in by
 * trades during the week. Covers positions opened, added to, trimmed, or closed within the week.
 */
function buildWeeklyContributors(
  holdings: PortfolioHolding[],
  transactions: PortfolioTransaction[],
  data: WeekStartCloses,
): Contributor[] {
  type Acc = {
    name: string;
    sharesNow: number;
    valueNow: number;
    netSharesInWeek: number;
    netCashInWeek: number;
    buyCostInWeek: number;
  };
  const bySymbol = new Map<string, Acc>();
  const acc = (symbol: string, name: string): Acc => {
    let a = bySymbol.get(symbol);
    if (!a) {
      a = {
        name: name.trim() || symbol,
        sharesNow: 0,
        valueNow: 0,
        netSharesInWeek: 0,
        netCashInWeek: 0,
        buyCostInWeek: 0,
      };
      bySymbol.set(symbol, a);
    }
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
    if (!isTrade(t) || t.date <= data.weekStartYmd) continue;
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
  for (const [symbol, a] of bySymbol) {
    const sharesStart = Math.max(0, a.sharesNow - a.netSharesInWeek);
    const closeStart = data.closes[symbol] ?? null;
    if (sharesStart > 0 && closeStart == null) continue;
    const startValue = sharesStart * (closeStart ?? 0);
    const gainUsd = normalizeUsdForDisplay(a.valueNow - startValue - a.netCashInWeek);
    const base = startValue + a.buyCostInWeek;
    out.push({
      symbol,
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
 * Home — this week's top winners and losers across the user's (non-combined) portfolios.
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

  const portfolioCloses = useWeekStartCloses(portfolioSymbolsKey, ready);
  const loading = !ready || portfolioCloses.loading;

  const { winners, losers } = useMemo(() => {
    const all = portfolioCloses.data
      ? buildWeeklyContributors(holdings, transactions, portfolioCloses.data)
      : [];
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
    <section aria-label="Weekly biggest contributors" className="min-w-0">
      <div className="mb-5 flex min-w-0 items-center gap-2">
        <h2 className={STOCK_OVERVIEW_SECTION_HEADING_CLASS}>Weekly biggest contributors</h2>
        {proGate ? <ProFeatureBadge /> : null}
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
            emptyLabel="No gains this week."
            emptyIcon={TrendingUp}
            locked={proGate}
          />
          <ContributorColumn
            title="Losers"
            rows={losers}
            emptyLabel="No losses this week."
            emptyIcon={TrendingDown}
            locked={proGate}
          />
        </div>
      )}
    </section>
  );
}
