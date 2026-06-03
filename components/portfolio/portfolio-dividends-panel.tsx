"use client";

import { memo, useEffect, useMemo, useRef, useState } from "react";
import { format, parseISO } from "date-fns";
import { CalendarDays, Clock } from "lucide-react";

import { CompanyLogo } from "@/components/screener/company-logo";
import { displayLogoUrlForPortfolioSymbol } from "@/lib/portfolio/portfolio-asset-display-logo";
import { portfolioAssetSymbolCaption } from "@/lib/portfolio/custom-asset-symbol";
import {
  portfolioHoldingDisplayName,
  usePortfolioHoldingDisplayNames,
} from "@/lib/portfolio/use-portfolio-holding-display-names";
import type {
  PortfolioDividendScheduleMonth,
  PortfolioDividendScheduleRow,
  PortfolioDividendsSchedulePayload,
} from "@/lib/portfolio/portfolio-dividends-schedule-types";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { cn } from "@/lib/utils";
import { PortfolioDividendsChart } from "@/components/portfolio/portfolio-dividends-chart";
import type { PortfolioHolding } from "@/components/portfolio/portfolio-types";

const usd0 = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const pctFmt = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Matches `portfolio-holdings-table.tsx` company column. */
const HOLDING_COMPANY_NAME_CLASS =
  "truncate text-[14px] font-semibold leading-5 text-[#09090B]";

const TD_BORDER = "border-b border-[#E4E4E7]";

/** Matches overview-market client session dedupe (`portfolio-overview-cards.tsx`). */
const DIVIDENDS_SESSION_TTL_MS = 5 * 60_000;

/** One desktop table + fixed columns so Payment/Amount align across month sections. */
const DIVIDENDS_DESKTOP_TABLE_CLASS =
  "hidden w-full min-w-[1040px] table-fixed border-separate border-spacing-0 sm:table";

const TH_CLASS = cn("whitespace-nowrap px-4 py-3 font-medium", TD_BORDER);
const TD_NUMERIC = cn("align-middle whitespace-nowrap px-4 py-3 text-right", TD_BORDER);

function DividendsTableColGroup() {
  return (
    <colgroup>
      <col style={{ width: "36%" }} />
      <col style={{ width: "14%" }} />
      <col style={{ width: "14%" }} />
      <col style={{ width: "12%" }} />
      <col style={{ width: "10%" }} />
      <col style={{ width: "14%" }} />
    </colgroup>
  );
}

function formatSignedUsd(n: number): string {
  const s = usd0.format(Math.abs(n));
  return n >= 0 ? `+${s}` : `-${s}`;
}

function formatSharesQty(n: number): string {
  const truncated = Math.trunc(n * 100) / 100;
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(truncated);
}

function formatShortDate(ymd: string): string {
  try {
    return format(parseISO(ymd), "MMM d, yy");
  } catch {
    return ymd;
  }
}

function StatusBadge({ status }: { status: PortfolioDividendScheduleRow["status"] }) {
  const declared = status === "declared";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-[12px] font-normal leading-4",
        declared ? "text-[#2563EB]" : "text-[#71717A]",
      )}
    >
      <span
        className={cn("h-1.5 w-1.5 shrink-0 rounded-full", declared ? "bg-[#2563EB]" : "bg-[#A1A1AA]")}
        aria-hidden
      />
      {declared ? "Declared" : "Estimated"}
    </span>
  );
}

function DividendRowMobile({
  row,
  companyName,
}: {
  row: PortfolioDividendScheduleRow;
  companyName: string;
}) {
  const logo = displayLogoUrlForPortfolioSymbol(row.symbol);
  const caption = portfolioAssetSymbolCaption(row.symbol);

  return (
    <div className="group relative flex min-w-0 items-center justify-between gap-3 py-3 transition-colors duration-75 hover:bg-neutral-50 sm:py-4">
      <div className="relative z-[1] flex min-w-0 flex-1 items-center gap-3">
        <CompanyLogo name={companyName} logoUrl={logo} symbol={row.symbol} />
        <div className="min-w-0">
          <div className={HOLDING_COMPANY_NAME_CLASS}>{companyName}</div>
          <div className="truncate text-[12px] font-normal leading-4 text-[#71717A]">
            {caption} · {formatShortDate(row.paymentDate)}
          </div>
        </div>
      </div>
      <div className="relative z-[1] min-w-0 shrink-0 text-right">
        <div className="font-['Inter'] text-[14px] font-semibold leading-5 tabular-nums text-[#09090B]">
          {usd0.format(row.totalUsd)}
        </div>
        <div className="mt-0.5 text-[12px] font-normal leading-4 tabular-nums text-[#71717A]">
          {formatSharesQty(row.shares)} × {usd0.format(row.perShareUsd)}
        </div>
      </div>
    </div>
  );
}

function DividendDesktopRow({
  row,
  companyName,
}: {
  row: PortfolioDividendScheduleRow;
  companyName: string;
}) {
  const logo = displayLogoUrlForPortfolioSymbol(row.symbol);
  const caption = portfolioAssetSymbolCaption(row.symbol);
  const breakdown = `${formatSharesQty(row.shares)} × ${usd0.format(row.perShareUsd)}`;

  return (
    <tr className="group h-[60px] max-h-[60px] transition-colors duration-75 hover:bg-neutral-50">
      <td className={cn("max-w-0 align-middle px-4 py-0", TD_BORDER)}>
        <div className="flex min-w-0 max-w-full items-center gap-3 py-2">
          <CompanyLogo name={companyName} logoUrl={logo} symbol={row.symbol} />
          <div className="min-w-0 text-left">
            <div className={HOLDING_COMPANY_NAME_CLASS}>{companyName}</div>
            <div className="truncate text-[12px] font-normal leading-4 text-[#71717A]">{caption}</div>
          </div>
        </div>
      </td>
      <td className={TD_NUMERIC}>
        <div className="inline-flex w-full items-center justify-end gap-1 font-['Inter'] text-[14px] leading-5 tabular-nums text-[#09090B]">
          {formatShortDate(row.paymentDate)}
          <Clock className="h-3.5 w-3.5 shrink-0 text-[#A1A1AA]" strokeWidth={1.75} aria-hidden />
        </div>
        <div className="mt-0.5 flex justify-end">
          <StatusBadge status={row.status} />
        </div>
      </td>
      <td className={TD_NUMERIC}>
        <div className="font-['Inter'] text-[14px] font-semibold leading-5 tabular-nums text-[#09090B]">
          {usd0.format(row.totalUsd)}
        </div>
        <div className="text-[12px] font-normal leading-4 tabular-nums text-[#71717A]">{breakdown}</div>
      </td>
      <td className={TD_NUMERIC}>
        <div className="font-['Inter'] text-[14px] font-medium leading-5 text-[#09090B]">
          {row.frequencyLabel ?? "—"}
        </div>
        {row.growthPct != null && Number.isFinite(row.growthPct) ? (
          <div
            className={cn(
              "text-[12px] font-medium leading-4 tabular-nums",
              row.growthPct >= 0 ? "text-[#16A34A]" : "text-[#DC2626]",
            )}
          >
            {row.growthPct >= 0 ? "▲" : "▼"} {pctFmt.format(Math.abs(row.growthPct))}%
          </div>
        ) : (
          <div className="text-[12px] font-normal leading-4 text-[#71717A]">—</div>
        )}
      </td>
      <td className={TD_NUMERIC}>
        <div className="font-['Inter'] text-[14px] font-medium leading-5 tabular-nums text-[#09090B]">
          {row.yieldPct != null ? `${pctFmt.format(row.yieldPct)}%` : "—"}
        </div>
        <div className="text-[12px] font-normal leading-4 text-[#71717A]">yield</div>
      </td>
      <td className={TD_NUMERIC}>
        <div className="font-['Inter'] text-[14px] font-medium leading-5 tabular-nums text-[#09090B]">
          {row.exDividendDate ? formatShortDate(row.exDividendDate) : "—"}
        </div>
        <div className="text-[12px] font-normal leading-4 text-[#71717A]">Ex-dividend date</div>
      </td>
    </tr>
  );
}

function DividendsScheduleTables({
  months,
  nameBySymbol,
}: {
  months: PortfolioDividendScheduleMonth[];
  nameBySymbol: Map<string, string>;
}) {
  return (
    <>
      <div className="space-y-0 sm:hidden">
        {months.map((month) => (
          <section key={month.monthKey} className="mb-10 last:mb-0">
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <h3 className="text-xl font-semibold tracking-tight text-[#09090B]">{month.label}</h3>
              {month.totalUsd > 0 ? (
                <span className="rounded-md bg-[#DCFCE7] px-2 py-0.5 text-[13px] font-semibold tabular-nums leading-5 text-[#16A34A]">
                  {formatSignedUsd(month.totalUsd)}
                </span>
              ) : null}
            </div>
            <div className="divide-y divide-[#E4E4E7] bg-white">
              {month.rows.map((row) => (
                <DividendRowMobile
                  key={`${row.symbol}-${row.paymentDate}-${row.exDividendDate ?? ""}`}
                  row={row}
                  companyName={nameBySymbol.get(row.symbol) ?? row.symbol}
                />
              ))}
            </div>
          </section>
        ))}
      </div>

      <div className="hidden w-full overflow-x-auto border-t border-[#E4E4E7] sm:block">
        <table className={DIVIDENDS_DESKTOP_TABLE_CLASS}>
          <DividendsTableColGroup />
          {months.map((month, monthIndex) => (
            <tbody key={month.monthKey}>
              <tr>
                <td colSpan={6} className="border-0 bg-white p-0">
                  <div
                    className={cn(
                      "flex flex-wrap items-center gap-3 pb-4",
                      monthIndex === 0 ? "pt-0" : "pt-10",
                    )}
                  >
                    <h3 className="text-xl font-semibold tracking-tight text-[#09090B]">{month.label}</h3>
                    {month.totalUsd > 0 ? (
                      <span className="rounded-md bg-[#DCFCE7] px-2 py-0.5 text-[13px] font-semibold tabular-nums leading-5 text-[#16A34A]">
                        {formatSignedUsd(month.totalUsd)}
                      </span>
                    ) : null}
                  </div>
                </td>
              </tr>
              <tr className="min-h-[44px] bg-white text-[14px] leading-5 text-[#71717A]">
                <th scope="col" className={cn(TH_CLASS, "text-left")}>
                  Company
                </th>
                <th scope="col" className={cn(TH_CLASS, "text-right")}>
                  Payment
                </th>
                <th scope="col" className={cn(TH_CLASS, "text-right")}>
                  Amount
                </th>
                <th scope="col" className={cn(TH_CLASS, "text-right")}>
                  Frequency
                </th>
                <th scope="col" className={cn(TH_CLASS, "text-right")}>
                  Yield
                </th>
                <th scope="col" className={cn(TH_CLASS, "text-right")}>
                  Ex-dividend
                </th>
              </tr>
              {month.rows.map((row) => (
                <DividendDesktopRow
                  key={`${row.symbol}-${row.paymentDate}-${row.exDividendDate ?? ""}`}
                  row={row}
                  companyName={nameBySymbol.get(row.symbol) ?? row.symbol}
                />
              ))}
            </tbody>
          ))}
        </table>
      </div>
    </>
  );
}

function PortfolioDividendsPanelInner({
  holdings,
  publicListingId,
}: {
  holdings: PortfolioHolding[];
  publicListingId?: string;
}) {
  const resolvedNames = usePortfolioHoldingDisplayNames(holdings);
  const [payload, setPayload] = useState<PortfolioDividendsSchedulePayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastLoadKeyRef = useRef("");
  const lastLoadStateRef = useRef<"idle" | "inflight" | "done" | "error">("idle");
  const loadGenRef = useRef(0);
  const holdingsRef = useRef(holdings);
  holdingsRef.current = holdings;

  const nameBySymbol = useMemo(() => {
    const m = new Map<string, string>();
    for (const h of holdings) {
      m.set(h.symbol.trim().toUpperCase(), portfolioHoldingDisplayName(h, resolvedNames));
    }
    return m;
  }, [holdings, resolvedNames]);

  /** Stable string key — never spread holdings into `useEffect` deps (length must stay constant). */
  const holdingsKey = useMemo(
    () =>
      holdings
        .map((h) => `${h.symbol.trim().toUpperCase()}:${h.shares}`)
        .sort()
        .join("|"),
    [holdings],
  );

  useEffect(() => {
    if (holdings.length === 0) {
      setPayload({ months: [] });
      setError(null);
      lastLoadKeyRef.current = "";
      lastLoadStateRef.current = "idle";
      return;
    }

    const loadKey = publicListingId ? `listing:${publicListingId}` : holdingsKey;
    if (loadKey === lastLoadKeyRef.current && lastLoadStateRef.current !== "error") {
      return;
    }
    lastLoadKeyRef.current = loadKey;

    const sessionKey = `finsepa.portfolio.dividendsSchedule.v1.${loadKey}`;
    try {
      const raw = sessionStorage.getItem(sessionKey);
      if (raw) {
        const parsed = JSON.parse(raw) as { at: number; data: PortfolioDividendsSchedulePayload };
        if (parsed && typeof parsed.at === "number" && Date.now() - parsed.at < DIVIDENDS_SESSION_TTL_MS) {
          setPayload(parsed.data);
          setError(null);
          lastLoadStateRef.current = "done";
          setLoading(false);
          return;
        }
      }
    } catch {
      // ignore
    }

    let cancelled = false;
    const gen = ++loadGenRef.current;
    lastLoadStateRef.current = "inflight";
    setLoading(true);
    setError(null);

    void (async () => {
      try {
        const res =
          publicListingId ?
            await fetch(
              `/api/portfolios/listings/${encodeURIComponent(publicListingId)}/dividends-schedule`,
              { credentials: "include", cache: "default" },
            )
          : await fetch("/api/portfolio/dividends-schedule", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              credentials: "include",
              cache: "no-store",
              body: JSON.stringify({
                holdings: holdingsRef.current.map((h) => ({ symbol: h.symbol, shares: h.shares })),
              }),
            });
        if (!res.ok) throw new Error("Failed to load dividend schedule");
        if (gen !== loadGenRef.current) return;

        const json = (await res.json()) as PortfolioDividendsSchedulePayload;
        if (cancelled) return;

        setPayload(json);
        setError(null);
        lastLoadStateRef.current = "done";
        try {
          sessionStorage.setItem(sessionKey, JSON.stringify({ at: Date.now(), data: json }));
        } catch {
          // ignore
        }
      } catch {
        if (cancelled || gen !== loadGenRef.current) return;
        setError("Could not load dividend schedule");
        lastLoadStateRef.current = "error";
        setPayload((prev) => prev ?? { months: [] });
      } finally {
        if (!cancelled && gen === loadGenRef.current) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [holdingsKey, publicListingId]);

  if (holdings.length === 0) {
    return (
      <Empty variant="card" className="min-h-[min(40vh,360px)]">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <CalendarDays className="h-6 w-6" strokeWidth={1.75} aria-hidden />
          </EmptyMedia>
          <EmptyTitle>No holdings yet</EmptyTitle>
          <EmptyDescription>
            Add dividend-paying stocks to see projected payouts by month for the next year.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  if (loading && !payload) {
    return (
      <div className="space-y-10 py-2">
        {[0, 1].map((i) => (
          <div key={i} className="animate-pulse space-y-4">
            <div className="h-7 w-40 rounded-md bg-[#F4F4F5]" />
            <div className="h-11 border-t border-[#E4E4E7] bg-[#FAFAFA]" />
            <div className="h-[60px] bg-[#F4F4F5]" />
            <div className="h-[60px] bg-[#F4F4F5]" />
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-[240px] items-center justify-center">
        <p className="text-sm text-[#71717A]">{error}</p>
      </div>
    );
  }

  const months = payload?.months ?? [];
  if (months.length === 0) {
    return (
      <Empty variant="card" className="min-h-[min(40vh,360px)]">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <CalendarDays className="h-6 w-6" strokeWidth={1.75} aria-hidden />
          </EmptyMedia>
          <EmptyTitle>No upcoming dividends</EmptyTitle>
          <EmptyDescription>
            None of your holdings have scheduled or projected dividend payments in the next 12 months.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div className="w-full min-w-0 pb-8">
      <PortfolioDividendsChart months={months} />
      <DividendsScheduleTables months={months} nameBySymbol={nameBySymbol} />
    </div>
  );
}

export const PortfolioDividendsPanel = memo(PortfolioDividendsPanelInner);
