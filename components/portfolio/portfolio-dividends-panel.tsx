"use client";

import { memo, useEffect, useMemo, useRef, useState } from "react";
import { format, parseISO } from "date-fns";
import { CalendarDays } from "@/lib/icons";

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
  PortfolioDividendsYearBounds,
} from "@/lib/portfolio/portfolio-dividends-schedule-types";
import type { PortfolioHolding, PortfolioTransaction } from "@/components/portfolio/portfolio-types";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { SecondaryTabs, type SecondaryTabItem } from "@/components/ui/secondary-tabs";
import { cn } from "@/lib/utils";
import { PortfolioDividendsChart } from "@/components/portfolio/portfolio-dividends-chart";

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

/** Desktop: company + dividend date + amount + frequency + yield. */
const DIVIDENDS_GRID =
  "grid w-full min-w-0 grid-cols-[minmax(0,2.2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,0.9fr)_minmax(0,0.85fr)] items-center gap-x-2";

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

function portfolioStartYear(transactions: readonly PortfolioTransaction[]): number | null {
  let min: number | null = null;
  for (const tx of transactions) {
    const d = typeof tx.date === "string" ? tx.date.trim() : "";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) continue;
    const y = Number(d.slice(0, 4));
    if (!Number.isFinite(y)) continue;
    min = min == null ? y : Math.min(min, y);
  }
  return min;
}

function defaultYearBounds(): PortfolioDividendsYearBounds {
  const currentYear = new Date().getFullYear();
  return { minYear: currentYear - 1, maxYear: currentYear + 1, currentYear };
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
            <div className="font-['Inter'] tabular-nums text-fg">{formatShortDate(row.paymentDate)}</div>
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
          </div>
          <div className={DIVIDENDS_NUMERIC_CELL}>
            <div className="font-['Inter'] text-[14px] font-medium leading-5 tabular-nums text-fg">
              {row.yieldPct != null ? `${pctFmt.format(row.yieldPct)}%` : "—"}
            </div>
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
            <ScreenerTableScroll minWidthClassName="min-w-0">
              <div className="bg-surface">
                {month.rows.map((row, i) => (
                  <DividendRowMobile
                    key={`${row.symbol}-${row.paymentDate}`}
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
                      <div className={DIVIDENDS_NUMERIC_CELL}>Date</div>
                      <div className={DIVIDENDS_NUMERIC_CELL}>Amount</div>
                      <div className={DIVIDENDS_NUMERIC_CELL}>Frequency</div>
                      <div className={DIVIDENDS_NUMERIC_CELL}>Yield</div>
                    </div>
                  </div>
                  <div className={SCREENER_TABLE_STROKE_INSET_CLASS} aria-hidden />
                </div>
                {month.rows.map((row, i) => (
                  <DividendDesktopRow
                    key={`${row.symbol}-${row.paymentDate}`}
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

function DividendsYearTabs({
  year,
  minYear,
  maxYear,
  onYearChange,
}: {
  year: number;
  minYear: number;
  maxYear: number;
  onYearChange: (year: number) => void;
}) {
  /** Newest → oldest (future left, older right) — same pill tabs as Overview Assets / Earnings. */
  const items = useMemo((): SecondaryTabItem<string>[] => {
    const out: SecondaryTabItem<string>[] = [];
    for (let y = maxYear; y >= minYear; y--) {
      out.push({ id: String(y), label: String(y) });
    }
    return out;
  }, [minYear, maxYear]);

  if (items.length === 0) return null;

  return (
    <SecondaryTabs
      className="mb-5"
      aria-label="Dividend year"
      items={items}
      value={String(year)}
      onValueChange={(id) => onYearChange(Number(id))}
    />
  );
}

function PortfolioDividendsPanelInner({
  holdings,
  transactions = [],
  publicListingId,
}: {
  holdings: PortfolioHolding[];
  transactions?: PortfolioTransaction[];
  publicListingId?: string;
}) {
  const resolvedNames = usePortfolioHoldingDisplayNames(holdings);
  const [payload, setPayload] = useState<PortfolioDividendsSchedulePayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedYear, setSelectedYear] = useState(() => new Date().getFullYear());
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

  const holdingsKey = useMemo(
    () =>
      holdings
        .map((h) => `${h.symbol.trim().toUpperCase()}:${h.shares}`)
        .sort()
        .join("|"),
    [holdings],
  );

  const inceptionYear = useMemo(() => portfolioStartYear(transactions), [transactions]);

  const yearBounds = payload?.yearBounds ?? defaultYearBounds();
  const navMinYear = Math.max(yearBounds.minYear, inceptionYear ?? yearBounds.minYear);
  const navMaxYear = yearBounds.maxYear;

  useEffect(() => {
    setSelectedYear((y) => Math.min(navMaxYear, Math.max(navMinYear, y)));
  }, [navMinYear, navMaxYear]);

  useEffect(() => {
    if (holdings.length === 0) {
      setPayload({ months: [], yearBounds: defaultYearBounds() });
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

    const sessionKey = `finsepa.portfolio.dividendsSchedule.v3.${loadKey}`;
    try {
      const raw = sessionStorage.getItem(sessionKey);
      if (raw) {
        const parsed = JSON.parse(raw) as { at: number; data: PortfolioDividendsSchedulePayload };
        if (
          parsed &&
          typeof parsed.at === "number" &&
          Date.now() - parsed.at < DIVIDENDS_SESSION_TTL_MS &&
          parsed.data?.yearBounds
        ) {
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

        const normalized: PortfolioDividendsSchedulePayload = {
          months: Array.isArray(json.months) ? json.months : [],
          yearBounds: json.yearBounds ?? defaultYearBounds(),
        };
        setPayload(normalized);
        setError(null);
        lastLoadStateRef.current = "done";
        try {
          sessionStorage.setItem(sessionKey, JSON.stringify({ at: Date.now(), data: normalized }));
        } catch {
          // ignore
        }
      } catch {
        if (cancelled || gen !== loadGenRef.current) return;
        setError("Could not load dividend schedule");
        lastLoadStateRef.current = "error";
        setPayload((prev) => prev ?? { months: [], yearBounds: defaultYearBounds() });
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

  const yearMonths = useMemo(() => {
    const prefix = `${selectedYear}-`;
    return (payload?.months ?? []).filter((m) => m.monthKey.startsWith(prefix));
  }, [payload?.months, selectedYear]);

  const yearHasRows = yearMonths.some((m) => m.rows.length > 0);

  if (holdings.length === 0) {
    return (
      <Empty variant="card" className="min-h-[min(40vh,360px)]">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <CalendarDays className="h-6 w-6" strokeWidth={1.75} aria-hidden />
          </EmptyMedia>
          <EmptyTitle>No holdings yet</EmptyTitle>
          <EmptyDescription>
            Add dividend-paying stocks to see payouts by month for each year.
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

  return (
    <div className="w-full min-w-0 pb-8">
      <DividendsYearTabs
        year={selectedYear}
        minYear={navMinYear}
        maxYear={navMaxYear}
        onYearChange={setSelectedYear}
      />
      <PortfolioDividendsChart months={yearMonths} year={selectedYear} />
      {yearHasRows ? (
        <DividendsScheduleTables months={yearMonths} nameBySymbol={nameBySymbol} />
      ) : (
        <Empty variant="card" className="min-h-[min(28vh,240px)]">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <CalendarDays className="h-6 w-6" strokeWidth={1.75} aria-hidden />
            </EmptyMedia>
            <EmptyTitle>No dividends in {selectedYear}</EmptyTitle>
            <EmptyDescription>
              {selectedYear > yearBounds.currentYear
                ? "No projected payouts for next year based on your current holdings."
                : "None of your holdings have dividend payments in this year."}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}
    </div>
  );
}

export const PortfolioDividendsPanel = memo(PortfolioDividendsPanelInner);
