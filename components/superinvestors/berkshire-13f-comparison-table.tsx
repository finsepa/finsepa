"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import type { Berkshire13fComparisonRow } from "@/lib/superinvestors/types";
import { CompanyLogo } from "@/components/screener/company-logo";
import { resolveEquityLogoUrlFromListingTicker } from "@/lib/screener/resolve-equity-logo-url";
import { formatUsdCompactSigDigits } from "@/lib/market/key-stats-basic-format";
import { SCREENER_MARKET_QUERY } from "@/lib/screener/screener-market-url";
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

/** Company | % of portfolio | Recent activity | Value — horizontal padding on table shell only. */
const rowGridFour =
  "grid w-full min-w-[640px] grid-cols-[minmax(180px,2.2fr)_minmax(72px,0.55fr)_minmax(120px,1.05fr)_minmax(96px,0.95fr)] gap-x-4";

const rowShellBase =
  "min-h-[60px] items-center border-b border-[#E4E4E7] transition-colors duration-75 last:border-b-0";

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
        <span className="line-clamp-2 text-[14px] font-semibold leading-5 text-[#09090B]">{displayName}</span>
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
  const merged = cn(gridClass, rowShellBase, "cursor-pointer hover:bg-neutral-50");
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
  const headerGrid = cn("h-11 min-h-[44px] items-center border-b border-[#E4E4E7]", rowGridFour);

  return (
    <div className="w-full overflow-x-auto">
      <div className="min-w-0 px-4">
        <div className="w-full border-collapse">
          <div className={headerGrid}>
            <div className={thCompany}>Company</div>
            <div className={thRight}>% of Portfolio</div>
            <div className={thRight}>Recent Activity</div>
            <div className={thRight}>Value</div>
          </div>

          {rows.map((r, i) => {
            const displayName = issuerDisplayTitle(r.companyName);
            return (
              <ComparisonRowShell
                key={`${r.cusip ?? r.companyName}-${i}`}
                ticker={r.ticker}
                displayName={displayName}
                gridClass={rowGridFour}
              >
                <div className={tdCompany}>
                  <CompanyTickerCell companyName={r.companyName} ticker={r.ticker} />
                </div>
                <div className={cn(tdNum, "font-medium")}>{pct.format(r.weight)}%</div>
                <div className={cn(tdNum, "font-medium")}>
                  <SharesColumnCell
                    hasPriorFiling={hasPriorFiling}
                    shares={r.shares}
                    sharesChangePct={r.sharesChangePct}
                  />
                </div>
                <div className={tdNum}>{formatUsdCompactSigDigits(r.valueUsd, 4)}</div>
              </ComparisonRowShell>
            );
          })}
        </div>
      </div>
    </div>
  );
}
