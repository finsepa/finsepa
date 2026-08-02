"use client";

import { memo, useEffect, useMemo, useRef, useState } from "react";
import { format, parseISO } from "date-fns";
import { CalendarDays, Clock } from "@/lib/icons";

import { CompanyLogo } from "@/components/screener/company-logo";
import {
  DEFAULT_TABLE_ROW_HOVER_PAD_CLASS,
  SCREENER_TABLE_DATA_ROW_CLASS,
  SCREENER_TABLE_HEADER_STICKY_CLASS,
  SCREENER_TABLE_HEADER_STROKE_HOVER_CLASS,
  SCREENER_TABLE_ROUNDED_HEADER_CLASS,
  SCREENER_TABLE_ROW_HOVER_SURFACE_CLASS,
  SCREENER_TABLE_STROKE_INSET_CLASS,
  TABLE_END_ALIGNED_PAD_CLASS,
  TABLE_START_ALIGNED_PAD_CLASS,
  ScreenerTableScroll,
} from "@/components/screener/screener-table-scroll";
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
  "truncate text-[14px] font-semibold leading-5 text-fg underline-offset-2 decoration-fg-muted group-hover/row:underline";

/** Matches overview-market client session dedupe (`portfolio-overview-cards.tsx`). */
const DIVIDENDS_SESSION_TTL_MS = 5 * 60_000;

/** Desktop dividends columns — company + payment/amount/frequency/yield/ex-date (fluid; no forced min-width that clips card insets). */
const DIVIDENDS_GRID =
  "grid w-full min-w-0 grid-cols-[minmax(0,2.2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,0.9fr)_minmax(0,0.75fr)_minmax(0,1fr)] items-center gap-x-2";

/** Right-aligned metrics — 12px end inset ({@link TABLE_END_ALIGNED_PAD_CLASS}). */
const DIVIDENDS_NUMERIC_CELL = cn("min-w-0 w-full text-right", TABLE_END_ALIGNED_PAD_CLASS);

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
        declared ? "text-accent" : "text-fg-muted",
      )}
    >
      <span
        className={cn("h-1.5 w-1.5 shrink-0 rounded-full", declared ? "bg-accent" : "bg-fg-subtle")}
        aria-hidden
      />
      {declared ? "Declared" : "Estimated"}
    </span>
  );
}

function DividendRowMobile({
  row,
  companyName,
  showDivider,
}: {
  row: PortfolioDividendScheduleRow;
  companyName: string;
  showDivider: boolean;
}) {
  const logo = displayLogoUrlForPortfolioSymbol(row.symbol);
  const caption = portfolioAssetSymbolCaption(row.symbol);

  return (
    <div className={SCREENER_TABLE_DATA_ROW_CLASS}>
      <div className={DEFAULT_TABLE_ROW_HOVER_PAD_CLASS}>
        <div
          className={cn(
            "group relative flex min-h-[60px] min-w-0 items-center justify-between gap-3 py-3 transition-colors duration-75 hover:bg-table-row-hover",
            SCREENER_TABLE_ROW_HOVER_SURFACE_CLASS,
          )}
        >
          <div className="relative z-[1] flex min-w-0 flex-1 items-center gap-3">
            <CompanyLogo name={companyName} logoUrl={logo} symbol={row.symbol} />
            <div className="min-w-0">
              <div className={HOLDING_COMPANY_NAME_CLASS}>{companyName}</div>
              <div className="truncate text-[12px] font-normal leading-4 text-fg-muted">
                {caption} · {formatShortDate(row.paymentDate)}
              </div>
            </div>
          </div>
          <div className="relative z-[1] min-w-0 shrink-0 text-right">
            <div className="font-['Inter'] text-[14px] font-semibold leading-5 tabular-nums text-fg">
              {usd0.format(row.totalUsd)}
            </div>
            <div className="mt-0.5 text-[12px] font-normal leading-4 tabular-nums text-fg-muted">
              {formatSharesQty(row.shares)} × {usd0.format(row.perShareUsd)}
            </div>
          </div>
        </div>
      </div>
      {showDivider ? <div className={SCREENER_TABLE_STROKE_INSET_CLASS} aria-hidden /> : null}
    </div>
  );
}

function DividendDesktopRow({
  row,
  companyName,
  showDivider,
}: {
  row: PortfolioDividendScheduleRow;
  companyName: string;
  showDivider: boolean;
}) {
  const logo = displayLogoUrlForPortfolioSymbol(row.symbol);
  const caption = portfolioAssetSymbolCaption(row.symbol);
  const breakdown = `${formatSharesQty(row.shares)} × ${usd0.format(row.perShareUsd)}`;

  return (
    <div className={SCREENER_TABLE_DATA_ROW_CLASS}>
      <div className={DEFAULT_TABLE_ROW_HOVER_PAD_CLASS}>
        <div
          className={cn(
            DIVIDENDS_GRID,
            "min-h-[60px] text-[14px] font-normal leading-5",
            SCREENER_TABLE_ROW_HOVER_SURFACE_CLASS,
          )}
        >
          <div className={cn("flex min-w-0 max-w-full items-center gap-3", TABLE_START_ALIGNED_PAD_CLASS)}>
            <CompanyLogo name={companyName} logoUrl={logo} symbol={row.symbol} />
            <div className="min-w-0 text-left">
              <div className={HOLDING_COMPANY_NAME_CLASS}>{companyName}</div>
              <div className="truncate text-[12px] font-normal leading-4 text-fg-muted">{caption}</div>
            </div>
          </div>
          <div className={DIVIDENDS_NUMERIC_CELL}>
            <div className="inline-flex w-full items-center justify-end gap-1 font-['Inter'] tabular-nums text-fg">
              {formatShortDate(row.paymentDate)}
              <Clock className="h-3.5 w-3.5 shrink-0 text-fg-subtle" strokeWidth={1.75} aria-hidden />
            </div>
            <div className="mt-0.5 flex justify-end">
              <StatusBadge status={row.status} />
            </div>
          </div>
          <div className={DIVIDENDS_NUMERIC_CELL}>
            <div className="font-['Inter'] text-[14px] font-semibold leading-5 tabular-nums text-fg">
              {usd0.format(row.totalUsd)}
            </div>
            <div className="text-[12px] font-normal leading-4 tabular-nums text-fg-muted">{breakdown}</div>
          </div>
          <div className={DIVIDENDS_NUMERIC_CELL}>
            <div className="font-['Inter'] text-[14px] font-medium leading-5 text-fg">
              {row.frequencyLabel ?? "—"}
            </div>
            {row.growthPct != null && Number.isFinite(row.growthPct) ? (
              <div
                className={cn(
                  "text-[12px] font-medium leading-4 tabular-nums",
                  row.growthPct >= 0 ? "text-up" : "text-down",
                )}
              >
                {row.growthPct >= 0 ? "▲" : "▼"} {pctFmt.format(Math.abs(row.growthPct))}%
              </div>
            ) : (
              <div className="text-[12px] font-normal leading-4 text-fg-muted">—</div>
            )}
          </div>
          <div className={DIVIDENDS_NUMERIC_CELL}>
            <div className="font-['Inter'] text-[14px] font-medium leading-5 tabular-nums text-fg">
              {row.yieldPct != null ? `${pctFmt.format(row.yieldPct)}%` : "—"}
            </div>
            <div className="text-[12px] font-normal leading-4 text-fg-muted">yield</div>
          </div>
          <div className={DIVIDENDS_NUMERIC_CELL}>
            <div className="font-['Inter'] text-[14px] font-medium leading-5 tabular-nums text-fg">
              {row.exDividendDate ? formatShortDate(row.exDividendDate) : "—"}
            </div>
            <div className="text-[12px] font-normal leading-4 text-fg-muted">Ex-dividend date</div>
          </div>
        </div>
      </div>
      {showDivider ? <div className={SCREENER_TABLE_STROKE_INSET_CLASS} aria-hidden /> : null}
    </div>
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
          <section key={month.monthKey} className="mb-5 last:mb-0">
            <div className="mb-3 flex flex-wrap items-center gap-3">
              <h3 className="text-xl font-semibold tracking-tight text-fg">{month.label}</h3>
              {month.totalUsd > 0 ? (
                <span className="rounded-md bg-up-soft px-2 py-0.5 text-[13px] font-semibold tabular-nums leading-5 text-up">
                  {formatSignedUsd(month.totalUsd)}
                </span>
              ) : null}
            </div>
            {/* Same card chrome + 16px row inset as holdings / screener tables. */}
            <ScreenerTableScroll minWidthClassName="min-w-0">
              <div className="bg-surface">
                {month.rows.map((row, i) => (
                  <DividendRowMobile
                    key={`${row.symbol}-${row.paymentDate}-${row.exDividendDate ?? ""}`}
                    row={row}
                    companyName={nameBySymbol.get(row.symbol) ?? row.symbol}
                    showDivider={i < month.rows.length - 1}
                  />
                ))}
              </div>
            </ScreenerTableScroll>
          </section>
        ))}
      </div>

      <div className="hidden space-y-5 sm:block">
        {months.map((month) => (
          <section key={month.monthKey} className="w-full min-w-0">
            <div className="mb-5 flex flex-wrap items-center gap-3">
              <h3 className="text-xl font-semibold tracking-tight text-fg">{month.label}</h3>
              {month.totalUsd > 0 ? (
                <span className="rounded-md bg-up-soft px-2 py-0.5 text-[13px] font-semibold tabular-nums leading-5 text-up">
                  {formatSignedUsd(month.totalUsd)}
                </span>
              ) : null}
            </div>
            <ScreenerTableScroll>
              <div className="bg-surface">
                <div
                  className={cn(
                    SCREENER_TABLE_HEADER_STICKY_CLASS,
                    SCREENER_TABLE_ROUNDED_HEADER_CLASS,
                    SCREENER_TABLE_HEADER_STROKE_HOVER_CLASS,
                    "md:border-b-0",
                  )}
                >
                  <div className={DEFAULT_TABLE_ROW_HOVER_PAD_CLASS}>
                    <div
                      className={cn(
                        DIVIDENDS_GRID,
                        "min-h-[44px] text-[14px] font-medium leading-5 text-fg-muted",
                      )}
                    >
                      <div className={cn("text-left", TABLE_START_ALIGNED_PAD_CLASS)}>Company</div>
                      <div className={DIVIDENDS_NUMERIC_CELL}>Payment</div>
                      <div className={DIVIDENDS_NUMERIC_CELL}>Amount</div>
                      <div className={DIVIDENDS_NUMERIC_CELL}>Frequency</div>
                      <div className={DIVIDENDS_NUMERIC_CELL}>Yield</div>
                      <div className={DIVIDENDS_NUMERIC_CELL}>Ex-dividend</div>
                    </div>
                  </div>
                  <div className={SCREENER_TABLE_STROKE_INSET_CLASS} aria-hidden />
                </div>
                {month.rows.map((row, i) => (
                  <DividendDesktopRow
                    key={`${row.symbol}-${row.paymentDate}-${row.exDividendDate ?? ""}`}
                    row={row}
                    companyName={nameBySymbol.get(row.symbol) ?? row.symbol}
                    showDivider={i < month.rows.length - 1}
                  />
                ))}
              </div>
            </ScreenerTableScroll>
          </section>
        ))}
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
    if (loadKey === lastLoadKeyRef.current && lastLoadStateRef.current === "done") {
      setLoading(false);
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
        if (gen === loadGenRef.current) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      if (lastLoadStateRef.current === "inflight") {
        lastLoadStateRef.current = "idle";
      }
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
            <div className="h-7 w-40 rounded-md bg-surface-muted" />
            <div className="h-11 border-t border-stroke bg-canvas" />
            <div className="h-[60px] bg-surface-muted" />
            <div className="h-[60px] bg-surface-muted" />
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-[240px] items-center justify-center">
        <p className="text-sm text-fg-muted">{error}</p>
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
