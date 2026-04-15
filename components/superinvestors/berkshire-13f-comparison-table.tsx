"use client";

import type { Berkshire13fComparisonRow, Berkshire13fSoldOutRow } from "@/lib/superinvestors/types";
import { CompanyLogo } from "@/components/screener/company-logo";
import { resolveEquityLogoUrlFromListingTicker } from "@/lib/screener/resolve-equity-logo-url";
import { cn } from "@/lib/utils";

const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
  minimumFractionDigits: 0,
});

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

const thBase =
  "whitespace-nowrap px-4 py-0 text-left align-middle text-[14px] font-medium leading-5 text-[#71717A] first:pl-4 last:pr-4";
const thRight = `${thBase} text-right`;
const tdBase =
  "whitespace-nowrap px-4 align-middle text-[14px] leading-5 first:pl-4 last:pr-4";
const tdNum = `${tdBase} text-right font-['Inter'] font-normal tabular-nums text-[#09090B]`;

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

function formatDelta(n: number | null): string {
  if (n == null) return "—";
  if (n === 0) return "0";
  const s = sharesFmt.format(Math.abs(n));
  return n > 0 ? `+${s}` : `-${s}`;
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

export function Berkshire13fComparisonTable({
  rows,
  soldOut,
  hasPriorFiling,
}: {
  rows: Berkshire13fComparisonRow[];
  soldOut: Berkshire13fSoldOutRow[];
  hasPriorFiling: boolean;
}) {
  return (
    <div className="space-y-8">
      <div className="w-full overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse">
            <thead>
              <tr className="h-11 min-h-[44px] border-b border-[#E4E4E7]">
                <th className={thBase}>Company</th>
                <th className={thRight}>Shares</th>
                {hasPriorFiling ? <th className={thRight}>Δ shares</th> : null}
                <th className={thRight}>Value</th>
                <th className={thRight}>Weight</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr
                  key={`${r.cusip ?? r.companyName}-${i}`}
                  className="min-h-[60px] border-b border-[#E4E4E7] transition-colors duration-75 hover:bg-neutral-50"
                >
                  <td
                    className={cn(
                      "px-4 py-1 align-middle text-[14px] leading-5 first:pl-4 last:pr-4",
                      "whitespace-normal",
                    )}
                  >
                    <CompanyTickerCell companyName={r.companyName} ticker={r.ticker} />
                  </td>
                  <td className={cn(tdNum, "whitespace-normal py-0 font-medium")}>
                    <SharesColumnCell
                      hasPriorFiling={hasPriorFiling}
                      shares={r.shares}
                      sharesChangePct={r.sharesChangePct}
                    />
                  </td>
                  {hasPriorFiling ? (
                    <td
                      className={cn(
                        tdNum,
                        "py-0 text-[14px] font-medium",
                        r.sharesDelta != null && r.sharesDelta > 0 && cellUp,
                        r.sharesDelta != null && r.sharesDelta < 0 && cellDown,
                        (r.sharesDelta == null || r.sharesDelta === 0) && "text-[#71717A]",
                      )}
                    >
                      {formatDelta(r.sharesDelta)}
                    </td>
                  ) : null}
                  <td className={cn(tdNum, "py-0")}>{usd.format(r.valueUsd)}</td>
                  <td className={cn(tdNum, "py-0")}>{pct.format(r.weight)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
      </div>

      {hasPriorFiling && soldOut.length > 0 ? (
        <div>
          <h3 className="mb-3 text-[14px] font-medium leading-5 text-[#71717A]">Sold out (prior filing only)</h3>
          <div className="w-full overflow-x-auto">
            <table className="w-full min-w-[400px] border-collapse">
              <thead>
                <tr className="h-11 min-h-[44px] border-b border-[#E4E4E7]">
                  <th className={thBase}>Company</th>
                  <th className={thRight}>Prior value</th>
                </tr>
              </thead>
              <tbody>
                {soldOut.map((s, i) => (
                  <tr
                    key={`sold-${s.cusip ?? s.companyName}-${i}`}
                    className="min-h-[60px] border-b border-[#E4E4E7] transition-colors duration-75 hover:bg-neutral-50"
                  >
                    <td
                      className={cn(
                        "px-4 py-1 align-middle text-[14px] leading-5 first:pl-4 last:pr-4",
                        "whitespace-normal",
                      )}
                    >
                      <CompanyTickerCell companyName={s.companyName} ticker={s.ticker} />
                    </td>
                    <td className={cn(tdNum, "py-0")}>{usd.format(s.previousValueUsd)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
}
