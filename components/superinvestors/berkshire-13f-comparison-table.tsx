"use client";

import { Fragment } from "react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Berkshire13fComparisonRow, SuperinvestorTransactionsPayload } from "@/lib/superinvestors/types";
import { SuperinvestorHoldingExpandButton } from "@/components/superinvestors/superinvestor-holding-expand-button";
import { SuperinvestorHoldingTransactionsPanel } from "@/components/superinvestors/superinvestor-holding-transactions-panel";
import {
  flattenSuperinvestorTransactions,
  normalizeSuperinvestorActivityHeadline,
  resolveHoldingRecentActivity,
  type HoldingRecentActivityDisplay,
} from "@/lib/superinvestors/superinvestor-transaction-utils";
import { SUPERINVESTOR_HOLDINGS_PAGE_SIZE } from "@/lib/superinvestors/superinvestors-holdings-page-size";
import { CompanyLogo } from "@/components/screener/company-logo";
import { resolveEquityLogoUrlFromListingTicker } from "@/lib/screener/resolve-equity-logo-url";
import { formatUsdCompactSigDigits } from "@/lib/market/key-stats-basic-format";
import { SCREENER_MARKET_QUERY } from "@/lib/screener/screener-market-url";
import { ScreenerPagination } from "@/components/ui/table-pagination";
import { cn } from "@/lib/utils";

const pct = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const sharesFmt = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 0,
});

/** Match screener `ChangeCell`: green / red for up / down. */
const cellUp = "text-[#16A34A]";
const cellDown = "text-[#DC2626]";

/** Header: no extra horizontal padding — row lives inside `px-4` shell so label lines up with logos. */
const thCompany =
  "whitespace-nowrap py-0 text-left align-middle text-[14px] font-medium leading-5 text-[#71717A]";
const thRight =
  "whitespace-nowrap py-0 text-right align-middle text-[14px] font-medium leading-5 text-[#71717A]";
const tdCompany = "min-w-0 py-1 text-left text-[14px] leading-5 whitespace-normal";
const tdNum =
  "whitespace-nowrap py-0 text-right align-middle font-['Inter'] text-[14px] font-normal leading-5 tabular-nums text-[#09090B]";

/** Company | % of portfolio | Recent activity | Shares | Value. */
const rowGridFive =
  "grid w-full min-w-[720px] grid-cols-[minmax(180px,2.05fr)_minmax(72px,0.55fr)_minmax(120px,1.05fr)_minmax(96px,0.9fr)_minmax(96px,0.9fr)] gap-x-4";

/** Mobile: Company | % of Portfolio. */
const mobileRowGrid =
  "grid grid-cols-[minmax(0,1fr)_minmax(5.5rem,auto)] gap-x-3 items-center";

const HOLDING_COMPANY_NAME_CLASS =
  "line-clamp-1 text-[14px] font-semibold leading-5 text-[#09090B] underline-offset-[3px] decoration-[#09090B] group-hover/company:underline sm:line-clamp-2";

const rowShellBase = "min-h-[60px] items-center transition-colors duration-75";

/** SEC names are often SHOUTCASE; present as readable title case for the UI. */
function issuerDisplayTitle(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => {
      const hyphenParts = word.split("-").map((p) =>
        p.length === 0 ? p : p.charAt(0).toUpperCase() + p.slice(1),
      );
      return hyphenParts.join("-");
    })
    .join(" ");
}

function HoldingCompanyCell({
  companyName,
  ticker,
  expanded,
  onToggleExpand,
}: {
  companyName: string;
  ticker: string | null;
  expanded: boolean;
  onToggleExpand: () => void;
}) {
  const displayName = issuerDisplayTitle(companyName);
  const sym = ticker?.trim() ? ticker.trim().toUpperCase() : null;
  const logoUrl = sym ? resolveEquityLogoUrlFromListingTicker(sym) : "";
  const href = rowHref(displayName, sym);

  return (
    <div className="flex min-w-0 max-w-full items-center gap-3 py-2 pr-2 text-left">
      <SuperinvestorHoldingExpandButton expanded={expanded} onToggle={onToggleExpand} />
      <Link
        href={href}
        prefetch={false}
        className="group/company flex min-w-0 flex-1 items-center gap-3 no-underline"
        aria-label={sym ? `Open ${displayName} (${sym})` : `Open screener to find ${displayName}`}
      >
        <CompanyLogo name={displayName} logoUrl={logoUrl} symbol={sym ?? undefined} size="md" />
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className={HOLDING_COMPANY_NAME_CLASS}>{displayName}</span>
          <span className="text-[12px] font-normal leading-4 text-[#71717A]">{sym ?? "—"}</span>
        </div>
      </Link>
    </div>
  );
}

const holdingActivitySublineClass = "text-[12px] font-normal leading-4 text-[#71717A]";

function RecentActivityColumnCell({ activity }: { activity: HoldingRecentActivityDisplay | null }) {
  if (!activity) {
    return (
      <div className="flex flex-col items-end justify-center gap-0.5 py-1 text-right font-medium tabular-nums text-[#71717A]">
        <span className="leading-4">-</span>
        <span className="leading-4">-</span>
      </div>
    );
  }

  const color = activity.positive ? cellUp : cellDown;
  return (
    <div className="flex flex-col items-end justify-center gap-0.5 py-1 text-right">
      <span className={cn("text-[14px] font-medium leading-4 tabular-nums", color)}>{activity.quarterLabel}</span>
      <span className={holdingActivitySublineClass}>
        {normalizeSuperinvestorActivityHeadline(activity.activityDetail)}
      </span>
    </div>
  );
}

/** Mobile-only combined cell: weight on top; quarter (colored) + action (grey) below. */
function MobilePortfolioCell({
  weight,
  activity,
}: {
  weight: number;
  activity: HoldingRecentActivityDisplay | null;
}) {
  return (
    <div className="flex flex-col items-end justify-center gap-0.5 text-right">
      <span className="text-[14px] font-medium leading-5 tabular-nums text-[#09090B]">
        {pct.format(weight)}%
      </span>
      {activity ?
        <>
          <span
            className={cn(
              "text-[12px] font-medium leading-4 tabular-nums",
              activity.positive ? cellUp : cellDown,
            )}
          >
            {activity.quarterLabel}
          </span>
          <span className={holdingActivitySublineClass}>
            {normalizeSuperinvestorActivityHeadline(activity.activityDetail)}
          </span>
        </>
      : <span className={holdingActivitySublineClass}>—</span>}
    </div>
  );
}

const ISSUER_TICKER_LS_KEY = "superinvestors:issuer-search-ticker:v1";

function rowResolveKey(r: Berkshire13fComparisonRow, displayName: string): string {
  return r.cusip?.trim()
    ? `CUSIP:${r.cusip.trim().toUpperCase()}`
    : `ISSUER:${displayName.toLowerCase()}`;
}

/**
 * Resolve missing tickers for the **current page only** via cached server lookup
 * (`/api/superinvestors/resolve-issuer-ticker`). Avoids the old `/api/search` storm
 * (up to 200 EODHD calls per profile).
 */
function useResolvedTickersForPage(pagedRows: Berkshire13fComparisonRow[]) {
  const [map, setMap] = useState<Record<string, string>>({});

  const keysToResolve = useMemo(() => {
    const out: { key: string; issuer: string }[] = [];
    const seen = new Set<string>();
    for (const r of pagedRows) {
      if (r.ticker?.trim()) continue;
      const issuer = issuerDisplayTitle(r.companyName).trim();
      if (!issuer) continue;
      const key = rowResolveKey(r, issuer);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ key, issuer });
    }
    return out;
  }, [pagedRows]);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    async function run() {
      let stored: Record<string, string> = {};
      try {
        const raw = window.localStorage.getItem(ISSUER_TICKER_LS_KEY);
        stored = raw ? (JSON.parse(raw) as Record<string, string>) : {};
      } catch {
        stored = {};
      }

      const next: Record<string, string> = { ...stored };
      if (!cancelled) setMap((prev) => ({ ...next, ...prev }));

      const queue = keysToResolve.filter((k) => !next[k.key]);
      const concurrency = 4;
      let idx = 0;

      async function worker() {
        while (idx < queue.length) {
          const cur = queue[idx++];
          try {
            const res = await fetch(
              `/api/superinvestors/resolve-issuer-ticker?issuer=${encodeURIComponent(cur.issuer)}`,
              { signal: controller.signal, credentials: "include" },
            );
            if (!res.ok) continue;
            const json = (await res.json()) as { ticker?: string | null };
            const sym = json.ticker?.trim().toUpperCase();
            if (!sym) continue;
            next[cur.key] = sym;
            if (!cancelled) setMap((prev) => ({ ...prev, [cur.key]: sym }));
          } catch {
            /* ignore */
          }
        }
      }

      await Promise.all(Array.from({ length: concurrency }, () => worker()));

      if (cancelled) return;
      try {
        window.localStorage.setItem(ISSUER_TICKER_LS_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
    }

    void run();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [keysToResolve]);

  return map;
}

/** Stock detail when we have a symbol; otherwise screener with a name hint (13F has no tickers). */
function rowHref(displayName: string, ticker: string | null): string {
  const t = ticker?.trim();
  if (t) return `/stock/${encodeURIComponent(t.toUpperCase())}`;
  const q = displayName.trim();
  const hint = q ? `&q=${encodeURIComponent(q)}` : "";
  return `/screener?${SCREENER_MARKET_QUERY}=stocks${hint}`;
}

export function Berkshire13fComparisonTable({
  rows,
  hasPriorFiling,
  transactions,
  onViewAllTransactions,
}: {
  rows: Berkshire13fComparisonRow[];
  hasPriorFiling: boolean;
  transactions: SuperinvestorTransactionsPayload;
  onViewAllTransactions: (searchQuery: string) => void;
}) {
  const [page, setPage] = useState(1);
  const [expandedRowKey, setExpandedRowKey] = useState<string | null>(null);
  const pageSize = SUPERINVESTOR_HOLDINGS_PAGE_SIZE;
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);

  const pagedRows = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return rows.slice(start, start + pageSize);
  }, [rows, safePage, pageSize]);

  const allTransactions = useMemo(
    () => flattenSuperinvestorTransactions(transactions.quarters),
    [transactions.quarters],
  );

  const currentQuarterLabel = transactions.quarters[0]?.quarterLabel ?? null;

  const headerGrid = cn("h-11 min-h-[44px] items-center bg-white", rowGridFive);
  const resolved = useResolvedTickersForPage(pagedRows);

  const toggleExpanded = useCallback((rowKey: string) => {
    setExpandedRowKey((prev) => (prev === rowKey ? null : rowKey));
  }, []);

  return (
    <div className="min-w-0 -mx-4 sm:mx-0">
      {/* ── Mobile layout ── */}
      <div className="sm:hidden">
        <div className="divide-y divide-[#E4E4E7] border-t border-b border-[#E4E4E7] bg-white">
          <div className={cn(mobileRowGrid, "h-11 min-h-[44px] bg-white px-4")}>
            <div className={thCompany}>Company</div>
            <div className={thRight}>% of Portfolio</div>
          </div>

          {pagedRows.map((r, i) => {
            const displayName = issuerDisplayTitle(r.companyName);
            const key = rowResolveKey(r, displayName);
            const mergedTicker = r.ticker?.trim() ? r.ticker : resolved[key] ?? null;
            const activityTicker = r.ticker?.trim() ? r.ticker : null;
            const globalIndex = (safePage - 1) * pageSize + i;
            const rowKey = `${r.cusip ?? r.companyName}-${globalIndex}-m`;
            const expanded = expandedRowKey === rowKey;
            return (
              <Fragment key={rowKey}>
                <div
                  className={cn(
                    mobileRowGrid,
                    rowShellBase,
                    "items-center bg-white px-4 transition-colors duration-75 hover:bg-neutral-50",
                  )}
                >
                  <div className={tdCompany}>
                    <HoldingCompanyCell
                      companyName={r.companyName}
                      ticker={mergedTicker}
                      expanded={expanded}
                      onToggleExpand={() => toggleExpanded(rowKey)}
                    />
                  </div>
                  <MobilePortfolioCell
                    weight={r.weight}
                    activity={resolveHoldingRecentActivity(
                      r,
                      allTransactions,
                      activityTicker,
                      currentQuarterLabel,
                      hasPriorFiling,
                    )}
                  />
                </div>
                {expanded ?
                  <SuperinvestorHoldingTransactionsPanel
                    row={r}
                    resolvedTicker={mergedTicker}
                    allTransactions={allTransactions}
                    onViewAllTransactions={onViewAllTransactions}
                  />
                : null}
              </Fragment>
            );
          })}
        </div>
      </div>

      {/* ── Desktop layout ── */}
      <div className="hidden overflow-x-auto pb-1 [-webkit-overflow-scrolling:touch] sm:block sm:overflow-visible sm:pb-0">
        <div className="min-w-[720px] sm:min-w-0">
          <div className="divide-y divide-[#E4E4E7] border-t border-b border-[#E4E4E7] bg-white">
            <div className={cn(headerGrid, "px-4")}>
              <div className={thCompany}>Company</div>
              <div className={thRight}>% of Portfolio</div>
              <div className={thRight}>Recent Activity</div>
              <div className={thRight}>Shares</div>
              <div className={thRight}>Value</div>
            </div>

            {pagedRows.map((r, i) => {
              const displayName = issuerDisplayTitle(r.companyName);
              const key = rowResolveKey(r, displayName);
              const mergedTicker = r.ticker?.trim() ? r.ticker : resolved[key] ?? null;
            const activityTicker = r.ticker?.trim() ? r.ticker : null;
              const globalIndex = (safePage - 1) * pageSize + i;
              const rowKey = `${r.cusip ?? r.companyName}-${globalIndex}`;
              const expanded = expandedRowKey === rowKey;
              return (
                <Fragment key={rowKey}>
                  <div
                    className={cn(
                      rowGridFive,
                      rowShellBase,
                      "items-center bg-white px-4 transition-colors duration-75 hover:bg-neutral-50",
                    )}
                  >
                    <div className={tdCompany}>
                      <HoldingCompanyCell
                        companyName={r.companyName}
                        ticker={mergedTicker}
                        expanded={expanded}
                        onToggleExpand={() => toggleExpanded(rowKey)}
                      />
                    </div>
                    <div className={cn(tdNum, "font-medium")}>{pct.format(r.weight)}%</div>
                    <div className={cn(tdNum, "font-medium")}>
                      <RecentActivityColumnCell
                        activity={resolveHoldingRecentActivity(
                          r,
                          allTransactions,
                          activityTicker,
                          currentQuarterLabel,
                          hasPriorFiling,
                        )}
                      />
                    </div>
                    <div className={tdNum}>{r.shares != null ? sharesFmt.format(r.shares) : "—"}</div>
                    <div className={tdNum}>{formatUsdCompactSigDigits(r.valueUsd, 4)}</div>
                  </div>
                  {expanded ?
                    <SuperinvestorHoldingTransactionsPanel
                      row={r}
                      resolvedTicker={mergedTicker}
                      allTransactions={allTransactions}
                      onViewAllTransactions={onViewAllTransactions}
                    />
                  : null}
                </Fragment>
              );
            })}
          </div>
        </div>
      </div>

      <ScreenerPagination
        page={safePage}
        totalPages={totalPages}
        onPageChange={setPage}
        aria-label="Holdings pages"
      />
    </div>
  );
}
