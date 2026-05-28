"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { Berkshire13fComparisonRow } from "@/lib/superinvestors/types";
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

const sharePctFmt = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
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

/** Company | % of portfolio | Recent activity | Shares | Value — horizontal padding on table shell only. */
const rowGridFive =
  "grid w-full min-w-[720px] grid-cols-[minmax(180px,2.05fr)_minmax(72px,0.55fr)_minmax(120px,1.05fr)_minmax(96px,0.9fr)_minmax(96px,0.9fr)] gap-x-4";

/** Mobile: Company | % of Portfolio (merged with activity subline). */
const mobileRowGrid =
  "grid grid-cols-[minmax(0,1fr)_minmax(5.5rem,auto)] gap-x-3 items-center";

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

function CompanyTickerCell({ companyName, ticker }: { companyName: string; ticker: string | null }) {
  const displayName = issuerDisplayTitle(companyName);
  const sym = ticker?.trim() ? ticker.trim().toUpperCase() : null;
  const logoUrl = sym ? resolveEquityLogoUrlFromListingTicker(sym) : "";
  return (
    <div className="flex min-w-0 items-center gap-3 pr-2 text-left">
      <CompanyLogo name={displayName} logoUrl={logoUrl} symbol={sym ?? undefined} size="md" />
      <div className="flex min-w-0 max-w-[min(280px,45vw)] flex-col gap-0.5 py-0.5">
        <span className="line-clamp-1 text-[14px] font-semibold leading-5 text-[#09090B] underline-offset-[3px] decoration-[#09090B] group-hover:underline sm:line-clamp-2">
          {displayName}
        </span>
        <span className="text-[12px] font-normal leading-4 text-[#71717A]">{sym ?? "—"}</span>
      </div>
    </div>
  );
}

function formatSharePctChange(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return "—";
  if (n === 0) return "0.00%";
  const s = `${sharePctFmt.format(Math.abs(n))}%`;
  return n > 0 ? `+${s}` : `-${s}`;
}

/** Mobile-only combined cell: "6.13%" top, "Increased +0.78%" subline. */
function MobilePortfolioCell({
  weight,
  hasPriorFiling,
  sharesChangePct,
}: {
  weight: number;
  hasPriorFiling: boolean;
  sharesChangePct: number | null;
}) {
  const pctVal = sharesChangePct;
  const hasChange = hasPriorFiling && pctVal != null && Number.isFinite(pctVal) && pctVal !== 0;
  const up = hasChange && pctVal! > 0;
  const color = hasChange ? (up ? cellUp : cellDown) : "text-[#71717A]";

  return (
    <div className="flex flex-col items-end justify-center text-right">
      <span className="text-[14px] font-medium leading-5 tabular-nums text-[#09090B]">
        {pct.format(weight)}%
      </span>
      <span className={cn("text-[12px] font-normal leading-4 tabular-nums", color)}>
        {hasChange ? `${up ? "Increased" : "Reduced"} ${formatSharePctChange(pctVal!)}` : "—"}
      </span>
    </div>
  );
}

/** Shares column when comparing filings: label + Δ%, or "-" / "-" when flat or N/A. */
function SharesColumnCell({
  hasPriorFiling,
  shares,
  sharesChangePct,
}: {
  hasPriorFiling: boolean;
  shares: number | null;
  sharesChangePct: number | null;
}) {
  if (!hasPriorFiling) {
    return <>{shares != null ? sharesFmt.format(shares) : "—"}</>;
  }

  const pct = sharesChangePct;
  const flat = pct == null || !Number.isFinite(pct) || pct === 0;

  if (flat) {
    return (
      <div className="flex flex-col items-end justify-center gap-0.5 py-1 text-right font-medium tabular-nums text-[#71717A]">
        <span className="leading-4">-</span>
        <span className="leading-4">-</span>
      </div>
    );
  }

  const up = pct > 0;
  const color = up ? cellUp : cellDown;
  return (
    <div className={cn("flex flex-col items-end justify-center gap-0.5 py-1 text-right text-[14px] font-medium leading-4", color)}>
      <span>{up ? "Increased" : "Reduced"}</span>
      <span className="tabular-nums leading-4">{formatSharePctChange(pct)}</span>
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

function ComparisonRowShell({
  ticker,
  displayName,
  gridClass,
  children,
}: {
  ticker: string | null;
  displayName: string;
  gridClass: string;
  children: ReactNode;
}) {
  const href = rowHref(displayName, ticker);
  const hasTicker = Boolean(ticker?.trim());
  const merged = cn(gridClass, rowShellBase, "group cursor-pointer no-underline hover:bg-neutral-50");
  return (
    <Link
      href={href}
      prefetch={false}
      className={merged}
      aria-label={
        hasTicker
          ? `Open ${displayName} (${ticker!.trim().toUpperCase()})`
          : `Open screener to find ${displayName}`
      }
    >
      {children}
    </Link>
  );
}

export function Berkshire13fComparisonTable({
  rows,
  hasPriorFiling,
}: {
  rows: Berkshire13fComparisonRow[];
  hasPriorFiling: boolean;
}) {
  const [page, setPage] = useState(1);
  const pageSize = SUPERINVESTOR_HOLDINGS_PAGE_SIZE;
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);

  const pagedRows = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return rows.slice(start, start + pageSize);
  }, [rows, safePage, pageSize]);

  const headerGrid = cn("h-11 min-h-[44px] items-center bg-white", rowGridFive);
  const resolved = useResolvedTickersForPage(pagedRows);

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
            const globalIndex = (safePage - 1) * pageSize + i;
            return (
              <ComparisonRowShell
                key={`${r.cusip ?? r.companyName}-${globalIndex}-m`}
                ticker={mergedTicker}
                displayName={displayName}
                gridClass={cn(mobileRowGrid, "px-4")}
              >
                <div className={tdCompany}>
                  <CompanyTickerCell companyName={r.companyName} ticker={mergedTicker} />
                </div>
                <MobilePortfolioCell
                  weight={r.weight}
                  hasPriorFiling={hasPriorFiling}
                  sharesChangePct={r.sharesChangePct}
                />
              </ComparisonRowShell>
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
              const globalIndex = (safePage - 1) * pageSize + i;
              return (
                <ComparisonRowShell
                  key={`${r.cusip ?? r.companyName}-${globalIndex}`}
                  ticker={mergedTicker}
                  displayName={displayName}
                  gridClass={cn(rowGridFive, "px-4")}
                >
                  <div className={tdCompany}>
                    <CompanyTickerCell companyName={r.companyName} ticker={mergedTicker} />
                  </div>
                  <div className={cn(tdNum, "font-medium")}>{pct.format(r.weight)}%</div>
                  <div className={cn(tdNum, "font-medium")}>
                    <SharesColumnCell
                      hasPriorFiling={hasPriorFiling}
                      shares={r.shares}
                      sharesChangePct={r.sharesChangePct}
                    />
                  </div>
                  <div className={tdNum}>{r.shares != null ? sharesFmt.format(r.shares) : "—"}</div>
                  <div className={tdNum}>{formatUsdCompactSigDigits(r.valueUsd, 4)}</div>
                </ComparisonRowShell>
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
