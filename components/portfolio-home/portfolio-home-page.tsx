"use client";

import dynamic from "next/dynamic";
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType,
  type CSSProperties,
  type RefObject,
} from "react";
import Link from "next/link";

import { usePlanAccessOptional } from "@/components/account/plan-access-provider";
import {
  MOBILE_ELEVATED_CARD_CLASS,
  OVERVIEW_PAGE_SECTIONS_STACK_CLASS,
  OVERVIEW_SECTION_INNER_STACK_CLASS,
  OVERVIEW_SECTION_TITLE_GAP_CLASS,
  STOCK_OVERVIEW_SECTION_HEADING_CLASS,
} from "@/components/design-system/card-surface-styles";
import { SegmentedControl } from "@/components/design-system/segmented-control";
import { ChangeCaretIcon } from "@/components/screener/change-pct";
import { CompanyLogo } from "@/components/screener/company-logo";
import { PortfolioListLogo } from "@/components/portfolio/portfolio-brokerage-logo";
import { BiggestContributors } from "@/components/portfolio-home/biggest-contributors";
import { PortfolioCreateMenu } from "@/components/layout/portfolio-create-menu";import { PortfolioQuickAddMenu } from "@/components/layout/portfolio-quick-add-menu";
import { FollowedSuperinvestorsCarousel } from "@/components/portfolio-home/followed-superinvestors-carousel";
import { HomeMarketTiles } from "@/components/portfolio-home/home-market-tiles";
import { UsMarketsSessionLabel } from "@/components/screener/us-markets-session-label";
import { WatchlistRailHideButton, WatchlistRailScrollContent } from "@/components/layout/watchlist-rail";
import { OverlayScrollArea } from "@/components/design-system/overlay-scroll-area";
import {
  UpcomingDividendsCarousel,
  UpcomingEarningsCarousel,
} from "@/components/portfolio-home/upcoming-earnings-carousel";
import {
  useWatchlistRailLayout,
  WATCHLIST_PANEL_WIDTH_PX,
} from "@/components/layout/watchlist-rail-layout-context";
import { usePortfolioWorkspace } from "@/components/portfolio/portfolio-workspace-context";
import {
  portfolioIsCombined,
  portfolioIsDemo,
  portfolioKindSubtext,
  type PortfolioEntry,
  type PortfolioHolding,
  type PortfolioTransaction,
} from "@/components/portfolio/portfolio-types";
import type { PortfolioChartPeriodSnapshot } from "@/components/portfolio/portfolio-overview-chart";
import { AssetChartSkeleton } from "@/components/ui/chart-skeleton";
import { WatchlistOptionsMenu } from "@/components/watchlist/watchlist-options-menu";
import { countManualPortfoliosForFreeQuota } from "@/lib/account/free-plan-quota";
import { FREE_MAX_REAL_PORTFOLIOS, FREE_MAX_WATCHLIST_ASSETS } from "@/lib/account/plan-entitlements";
import { formatSignedUsdAmountGrouped2dp } from "@/lib/market/key-stats-basic-format";
import { displayLogoUrlForPortfolioSymbol } from "@/lib/portfolio/portfolio-asset-display-logo";
import type { PortfolioChartRange } from "@/lib/portfolio/portfolio-chart-types";
import {
  lifetimeEquityProfitPct,
  netCashUsd,
  normalizeUsdForDisplay,
  totalCostBasisInvested,
  totalNetWorth,
} from "@/lib/portfolio/overview-metrics";
import { lifetimeEquityProfitUsd } from "@/lib/portfolio/realized-pnl-from-trades";
import { useWatchlistEnrichedItems } from "@/lib/watchlist/use-watchlist-enriched-items";
import { useWatchlist } from "@/lib/watchlist/use-watchlist-client";
import { Maximize2, Settings } from "@/lib/icons";
import { ManagePortfoliosModal } from "@/components/portfolio-home/manage-portfolios-modal";
import { topbarSquircleActiveClass, topbarSquircleIconClass } from "@/components/design-system/topbar-control-classes";
import { ChartEmptyIllustration, PortfolioEmptyIllustration } from "@/components/portfolio-home/portfolio-empty-illustration";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { cn } from "@/lib/utils";

const HOME_CHART_RANGE_OPTIONS: { value: PortfolioChartRange; label: string }[] = [
  { value: "1d", label: "1D" },
  { value: "5d", label: "5D" },
  { value: "1m", label: "1M" },
  { value: "6m", label: "6M" },
  { value: "ytd", label: "YTD" },
  { value: "1y", label: "1Y" },
  { value: "5y", label: "5Y" },
  { value: "all", label: "ALL" },
];

/** Drawing space only; the SVG stretches to the header block's height. */
type HomePortfolioChartProps = {
  transactions: PortfolioTransaction[];
  benchmarkInvestedUsd?: number | null;
  onPeriodSnapshot?: (snap: PortfolioChartPeriodSnapshot | null) => void;
  hideChrome?: boolean;
  fixedRange?: PortfolioChartRange | null;
};

const PortfolioOverviewChart = dynamic(
  () =>
    import("@/components/portfolio/portfolio-overview-chart").then((m) => ({
      default: m.PortfolioOverviewChart as ComponentType<HomePortfolioChartProps>,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="relative h-[240px] w-full sm:h-[320px]">
        <AssetChartSkeleton fill />
      </div>
    ),
  },
);

const usdHome = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function portfolioValueUsd(
  portfolioId: string,
  holdingsByPortfolioId: ReturnType<typeof usePortfolioWorkspace>["holdingsByPortfolioId"],
  transactionsByPortfolioId: ReturnType<typeof usePortfolioWorkspace>["transactionsByPortfolioId"],
): number {
  const holdings = holdingsByPortfolioId[portfolioId] ?? [];
  const transactions = transactionsByPortfolioId[portfolioId] ?? [];
  return normalizeUsdForDisplay(totalNetWorth(holdings, netCashUsd(transactions)));
}

function equityHoldings(holdings: PortfolioHolding[]): PortfolioHolding[] {
  return holdings.filter((h) => h.symbol.trim().toUpperCase() !== "USD");
}

function topHoldingsByValue(holdings: PortfolioHolding[], limit: number): PortfolioHolding[] {
  return [...equityHoldings(holdings)]
    .sort((a, b) => b.currentValue - a.currentValue)
    .slice(0, limit);
}

function PortfolioAccountCard({
  portfolio,
  value,
  holdings,
  transactions,
  href,
}: {
  portfolio: PortfolioEntry;
  value: number;
  holdings: PortfolioHolding[];
  transactions: PortfolioTransaction[];
  href: string;
}) {
  const subtitle = portfolioKindSubtext(portfolio);
  const positions = equityHoldings(holdings);
  const top3 = topHoldingsByValue(holdings, 3);
  const returnUsd = normalizeUsdForDisplay(lifetimeEquityProfitUsd(holdings, transactions));
  const returnPct = lifetimeEquityProfitPct(holdings, transactions);
  const hasReturn = returnUsd !== 0 || (returnPct != null && returnPct !== 0);
  const returnPositive = returnUsd > 0 || (returnUsd === 0 && (returnPct ?? 0) >= 0);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const actionsVisible = hovered || focused || menuOpen;

  return (
    <div
      className={cn(
        "group relative flex w-full flex-nowrap items-center gap-3 rounded-2xl px-3 py-3 text-left transition-colors sm:gap-4 sm:px-4",
        MOBILE_ELEVATED_CARD_CLASS,
        "hover:bg-surface-muted/60",
      )}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocused(false);
      }}
    >
      {/* Stretched row link — actions sit above it so buttons aren't nested inside an anchor. */}
      <Link
        href={href}
        aria-label={portfolio.name}
        className="absolute inset-0 rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fg/15"
      />
      {/* Logo + name / type */}
      <span className="flex min-w-0 flex-1 items-center gap-3">
        <PortfolioListLogo portfolio={portfolio} size="list" />
        <span className="min-w-0">
          <span className="flex min-w-0 items-center gap-1">
            <span className="truncate text-[14px] font-semibold leading-5 text-fg underline-offset-2 decoration-fg-muted group-hover:underline">
              {portfolio.name}
            </span>
            <span
              className={cn(
                "relative z-10 -my-1 flex shrink-0 items-center gap-0.5 transition-opacity duration-150",
                actionsVisible ? "opacity-100" : "pointer-events-none opacity-0",
              )}
            >
              <PortfolioQuickAddMenu
                variant="ghost"
                manageActions
                aria-label={`${portfolio.name} options`}
                portfolioId={portfolio.id}
                onOpenChange={setMenuOpen}
              />
            </span>
          </span>
          {subtitle ? (
            <span className="block truncate text-[12px] font-normal leading-4 text-fg-muted">
              {subtitle}
            </span>
          ) : null}
        </span>
      </span>

      {/* Positions + logos on one line */}
      <span className="hidden shrink-0 items-center gap-3 sm:inline-flex">
        <span className="w-24 text-right text-[13px] leading-5 text-fg-muted tabular-nums">
          {positions.length > 0
            ? `${positions.length} ${positions.length === 1 ? "position" : "positions"}`
            : "—"}
        </span>
        <span className="flex h-5 w-14 items-center justify-start" aria-hidden>
          {top3.map((h, i) => (
            <span
              key={h.id}
              className="-ml-0.5 first:ml-0"
              style={{ zIndex: top3.length - i }}
            >
              <span
                className="block overflow-hidden rounded-full"
                style={{ boxShadow: "0 0 0 1px var(--fs-stroke), 0 0 0 2.5px var(--fs-surface)" }}
              >
                <CompanyLogo
                  name={h.name}
                  logoUrl={displayLogoUrlForPortfolioSymbol(h.symbol)}
                  symbol={h.symbol}
                  size="xs"
                  className="border-0"
                />
              </span>
            </span>
          ))}
        </span>
      </span>

      {/* Value + profit */}
      <span className="flex w-44 shrink-0 flex-col items-end gap-0.5 tabular-nums">
        <span
          className={cn(
            "text-[14px] font-semibold leading-5",
            value < 0 ? "text-down" : "text-fg",
          )}
        >
          {usdHome.format(value)}
        </span>
        {hasReturn ? (
          <span
            className={cn(
              "inline-flex items-center gap-1 text-[12px] font-medium leading-4",
              returnPositive ? "text-up" : "text-down",
            )}
          >
            <span>{formatSignedUsdAmountGrouped2dp(returnUsd)}</span>
            {returnPct != null && Number.isFinite(returnPct) ? (
              <span className="inline-flex items-center gap-0.5">
                <ChangeCaretIcon direction={returnPositive ? "up" : "down"} size={11} />
                <span>{Math.abs(returnPct).toFixed(2)}%</span>
              </span>
            ) : null}
          </span>
        ) : (
          <span className="text-[12px] leading-4 text-fg-muted">—</span>
        )}
      </span>
    </div>
  );
}

/**
 * Post-signup Portfolio home — total worth + accounts; right = watchlist column.
 */
export function PortfolioHomePage() {
  const {
    portfolios,
    holdingsByPortfolioId,
    transactionsByPortfolioId,
    portfolioDisplayReady,
    holdingsLiveMarked,
  } = usePortfolioWorkspace();
  const [mounted, setMounted] = useState(false);
  const [chartRange, setChartRange] = useState<PortfolioChartRange>("all");
  const [periodSnap, setPeriodSnap] = useState<PortfolioChartPeriodSnapshot | null>(null);
  const [manageOpen, setManageOpen] = useState(false);
  const asideRef = useRef<HTMLElement>(null);
  const asideStickyStyle = useViewportStickyAsideStyle(asideRef);
  const { collapsed: watchlistHidden } = useWatchlistRailLayout();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    setPeriodSnap(null);
  }, [chartRange]);

  const ready = mounted && portfolioDisplayReady;

  const plan = usePlanAccessOptional();
  /** Demo doesn't use the Free quota, so it adds one slot to both sides (demo + 1 manual = 2/2). */
  const demoSlot = portfolios.some(portfolioIsDemo) ? 1 : 0;
  const freePortfoliosCountBadge =
    plan?.isFree === true
      ? `${countManualPortfoliosForFreeQuota(portfolios) + demoSlot}/${(plan.maxRealPortfolios ?? FREE_MAX_REAL_PORTFOLIOS) + demoSlot}`
      : null;

  /** Includes the demo portfolio; skips combined views (double counting). */
  const netWorthPortfolios = useMemo(() => portfolios.filter((p) => !portfolioIsCombined(p)), [portfolios]);

  const aggregateTransactions = useMemo(() => {
    const out: PortfolioTransaction[] = [];
    for (const p of netWorthPortfolios) {
      const txs = transactionsByPortfolioId[p.id];
      if (txs?.length) out.push(...txs);
    }
    return out;
  }, [netWorthPortfolios, transactionsByPortfolioId]);

  const aggregateHoldings = useMemo(() => {
    const out: PortfolioHolding[] = [];
    for (const p of netWorthPortfolios) {
      const hs = holdingsByPortfolioId[p.id];
      if (hs?.length) out.push(...hs);
    }
    return out;
  }, [netWorthPortfolios, holdingsByPortfolioId]);

  /** Fill prices can be years old — hold $ values until the first session/live marks land. */
  const valuesReady = ready && (holdingsLiveMarked || aggregateHoldings.length === 0);

  const totalWorth = useMemo(() => {
    let sum = 0;
    for (const p of netWorthPortfolios) {
      sum += portfolioValueUsd(p.id, holdingsByPortfolioId, transactionsByPortfolioId);
    }
    return sum;
  }, [netWorthPortfolios, holdingsByPortfolioId, transactionsByPortfolioId]);

  const chartBenchmarkInvested = totalCostBasisInvested(aggregateHoldings);
  const rangeLabel =
    HOME_CHART_RANGE_OPTIONS.find((o) => o.value === chartRange)?.label ?? "ALL";

  const periodProfitUsd =
    periodSnap?.profitUsd != null ? normalizeUsdForDisplay(periodSnap.profitUsd) : null;
  const periodReturnPct = periodSnap?.returnPct ?? null;
  const periodPositive =
    (periodProfitUsd ?? 0) > 0 ||
    ((periodProfitUsd ?? 0) === 0 && (periodReturnPct ?? 0) >= 0);

  return (
    <div className="flex w-full min-w-0 flex-col items-stretch gap-8 md:flex-row md:items-start md:gap-8">
      <div className={cn("min-w-0 flex-1", OVERVIEW_PAGE_SECTIONS_STACK_CLASS)}>
        <section aria-label="Markets" className={cn("min-w-0", OVERVIEW_SECTION_INNER_STACK_CLASS)}>
          <div className="flex h-8 items-center">
            <UsMarketsSessionLabel />
          </div>
          <HomeMarketTiles />
        </section>

        <section
          aria-label="Performance"
          className={cn(OVERVIEW_SECTION_INNER_STACK_CLASS, "[--fs-chart-plot-bg:var(--fs-panel)]")}
        >
          <div className="flex items-start justify-between gap-3">
            <header className="flex min-w-0 flex-col items-start gap-1">
              <p className="text-xs font-medium text-fg-muted">Total net worth</p>
              <h1
                suppressHydrationWarning
                className={cn(
                  "text-2xl font-semibold leading-7 tabular-nums tracking-tight",
                  totalWorth < 0 ? "text-down" : "text-fg",
                )}
              >
                {valuesReady ? usdHome.format(totalWorth) : "—"}
              </h1>
              {valuesReady && periodProfitUsd != null ? (
                <p className="inline-flex flex-nowrap items-center gap-1.5 text-sm font-normal tabular-nums">
                  <span className={periodPositive ? "text-up" : "text-down"}>
                    {formatSignedUsdAmountGrouped2dp(periodProfitUsd)}
                  </span>
                  {periodReturnPct != null ? (
                    <span
                      className={cn(
                        "inline-flex items-center gap-0.5",
                        periodPositive ? "text-up" : "text-down",
                      )}
                    >
                      <ChangeCaretIcon direction={periodPositive ? "up" : "down"} size={12} />
                      <span>{Math.abs(periodReturnPct).toFixed(2)}%</span>
                    </span>
                  ) : null}
                  <span className="text-fg-muted">{rangeLabel}</span>
                </p>
              ) : null}
            </header>

            <SegmentedControl
              aria-label="Chart range"
              options={HOME_CHART_RANGE_OPTIONS}
              value={chartRange}
              onChange={setChartRange}
              size="sm"
              className="hidden shrink-0 sm:inline-flex"
            />
          </div>

          <SegmentedControl
            aria-label="Chart range"
            options={HOME_CHART_RANGE_OPTIONS.filter((o) => o.value !== "ytd")}
            value={chartRange}
            onChange={setChartRange}
            size="sm"
            fullWidth
            className="sm:hidden"
          />

          <div id="home-net-worth-chart">
            {!ready ? (
              <div className="relative h-[240px] w-full sm:h-[320px]">
                <AssetChartSkeleton fill />
              </div>
            ) : netWorthPortfolios.length === 0 ? (
              <Empty variant="card">
                <EmptyHeader>
                  <PortfolioEmptyIllustration className="mb-6" />
                  <EmptyTitle>No portfolios yet</EmptyTitle>
                  <EmptyDescription className="max-w-sm">
                    Add a portfolio to track your net worth and performance.
                  </EmptyDescription>
                </EmptyHeader>
                <EmptyContent className="mt-6">
                  <PortfolioCreateMenu variant="button" aria-label="Add portfolio" />
                </EmptyContent>
              </Empty>
            ) : aggregateTransactions.length === 0 ? (
              <Empty variant="card">
                <EmptyHeader>
                  <ChartEmptyIllustration className="mb-6" />
                  <EmptyTitle>No transactions yet</EmptyTitle>
                  <EmptyDescription className="max-w-sm">
                    {netWorthPortfolios.length === 1
                      ? "Your portfolio has no trades or cash movements yet. Add some to see your net worth over time."
                      : "None of your portfolios have trades or cash movements yet. Add some to see your net worth over time."}
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <PortfolioOverviewChart
                key={`home-total-${netWorthPortfolios.map((p) => p.id).join(",")}`}
                transactions={aggregateTransactions}
                benchmarkInvestedUsd={chartBenchmarkInvested}
                onPeriodSnapshot={setPeriodSnap}
                hideChrome
                fixedRange={chartRange}
              />
            )}
          </div>
        </section>

        <section aria-label="My portfolios" className="min-w-0">
          <div className={cn(OVERVIEW_SECTION_TITLE_GAP_CLASS, "flex items-center justify-between gap-2")}>
            <div className="flex min-w-0 items-center gap-2">
              <h2 className={STOCK_OVERVIEW_SECTION_HEADING_CLASS}>My portfolios</h2>
              {ready && freePortfoliosCountBadge ? (
                <span className="inline-flex h-[18px] shrink-0 items-center justify-center rounded-full bg-stroke px-[6px] text-[11px] font-medium tabular-nums leading-none text-fg">
                  {freePortfoliosCountBadge}
                </span>
              ) : null}
            </div>
            {ready && portfolios.length > 0 ? (
              <button
                type="button"
                onClick={() => setManageOpen(true)}
                aria-label="Manage portfolios"
                title="Manage portfolios"
                className={cn(
                  topbarSquircleIconClass,
                  "shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fg/15 focus-visible:ring-offset-2",
                  manageOpen && topbarSquircleActiveClass,
                )}
              >
                <Settings className="size-4" strokeWidth={2} aria-hidden />
              </button>
            ) : null}
          </div>
          {!valuesReady ? (
            <div className="flex flex-col gap-3">
              {[0, 1, 2].map((i) => (
                <div key={i} className={cn("h-[68px] animate-pulse", MOBILE_ELEVATED_CARD_CLASS)} />
              ))}
            </div>
          ) : portfolios.length === 0 ? (
            <p className="rounded-2xl border border-stroke-subtle bg-surface px-4 py-6 text-sm text-fg-muted">
              No portfolios yet.
            </p>
          ) : (
            <ul className="m-0 flex list-none flex-col gap-3 p-0">
              {portfolios.map((p) => {
                const holdings = holdingsByPortfolioId[p.id] ?? [];
                const transactions = transactionsByPortfolioId[p.id] ?? [];
                const value = normalizeUsdForDisplay(
                  totalNetWorth(holdings, netCashUsd(transactions)),
                );
                return (
                  <li key={p.id}>
                    <PortfolioAccountCard
                      portfolio={p}
                      value={value}
                      holdings={holdings}
                      transactions={transactions}
                      href={`/home/${p.id}`}
                    />
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <ManagePortfoliosModal open={manageOpen} onClose={() => setManageOpen(false)} />

        <BiggestContributors
          holdings={aggregateHoldings}
          transactions={aggregateTransactions}
          ready={valuesReady}
        />

        <UpcomingEarningsCarousel />
        <UpcomingDividendsCarousel />
        <FollowedSuperinvestorsCarousel />
      </div>

      <aside
        ref={asideRef}
        className={cn(
          "flex w-full min-w-0 flex-col md:w-[var(--home-aside-w)] md:shrink-0 md:self-start md:overflow-hidden",
          watchlistHidden && "md:hidden",
        )}
        style={
          {
            "--home-aside-w": `${WATCHLIST_PANEL_WIDTH_PX}px`,
            ...asideStickyStyle,
          } as CSSProperties
        }
      >
        <HomeAsideContent />
      </aside>
    </div>
  );
}


const DESKTOP_MQ = "(min-width: 768px)";

/**
 * Desktop: pin the aside inside the shell's scrolling `<main>` and cap it to the visible height,
 * so the watchlist scrolls on its own instead of stretching the page.
 */
function useViewportStickyAsideStyle(asideRef: RefObject<HTMLElement | null>): CSSProperties {
  const [style, setStyle] = useState<CSSProperties>({});

  useLayoutEffect(() => {
    const aside = asideRef.current;
    const scroller = aside?.closest("main");
    if (!aside || !scroller) return;
    const mq = window.matchMedia(DESKTOP_MQ);

    const update = () => {
      if (!mq.matches) {
        setStyle({});
        return;
      }
      const cs = getComputedStyle(aside.parentElement?.parentElement ?? scroller);
      const padTop = parseFloat(cs.paddingTop) || 0;
      const padBottom = parseFloat(cs.paddingBottom) || 0;
      const maxHeight = Math.max(0, scroller.clientHeight - padTop - padBottom);
      setStyle((prev) =>
        prev.maxHeight === maxHeight && prev.top === padTop
          ? prev
          : { position: "sticky", top: padTop, maxHeight },
      );
    };

    update();
    const ro = new ResizeObserver(update);
    ro.observe(scroller);
    mq.addEventListener("change", update);
    return () => {
      ro.disconnect();
      mq.removeEventListener("change", update);
    };
  }, [asideRef]);

  return style;
}

function HomeAsideContent() {
  const { toggleCollapsed: hideWatchlist } = useWatchlistRailLayout();
  const {
    watchlists,
    activeWatchlistId,
    activeWatchlistName,
    watchedTickers,
    createWatchlist,
    renameActiveWatchlist,
    deleteActiveWatchlist,
    switchWatchlist,
    moveActiveWatchlistItem,
    removeFromActiveWatchlist,
    storageHydrated,
    serverSynced,
  } = useWatchlist();
  const { items, empty, error, loading, pricesLoading } = useWatchlistEnrichedItems({ enabled: true });
  const awaitingServerList = !serverSynced && watchedTickers.length === 0;
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const watchlistReady = mounted && storageHydrated;
  const plan = usePlanAccessOptional();
  const freeWatchlistMax = plan?.isFree === true ? (plan.maxWatchlistAssets ?? FREE_MAX_WATCHLIST_ASSETS) : null;
  /** One list: its name is the section title (renamable via “…”). 2+ lists: the title is a switcher dropdown, like the rail. */
  const singleWatchlist = watchlists.length <= 1;
  /** Free plan only — shows usage against the cap; Pro has no limit to show. */
  const activeWatchlistBadge =
    freeWatchlistMax != null ? `${watchedTickers.length}/${freeWatchlistMax}` : null;
  return (
    <div className="flex min-h-0 w-full min-w-0 flex-col gap-6">
      <section
        className={cn("flex min-h-0 min-w-0 flex-col overflow-hidden p-2", MOBILE_ELEVATED_CARD_CLASS)}
        aria-label="Watchlist"
      >
        <div className="mb-1 flex shrink-0 items-center justify-between gap-2 pl-3">
          {!watchlistReady ? (
            <div className="h-4 w-24 animate-pulse rounded bg-stroke" aria-hidden />
          ) : singleWatchlist ? (
            <div className="flex min-w-0 items-center gap-2">
              <h2 className="truncate text-[15px] font-semibold leading-6 text-fg">
                {activeWatchlistName || "Watchlist"}
              </h2>
              {activeWatchlistBadge ? (
                <span className="inline-flex h-[18px] min-w-[18px] shrink-0 items-center justify-center rounded-full bg-stroke px-[6px] text-[11px] font-medium tabular-nums leading-none text-fg">
                  {activeWatchlistBadge}
                </span>
              ) : null}
            </div>
          ) : (
            <div className="flex min-w-0 flex-1">
              <WatchlistOptionsMenu
                name={activeWatchlistName || "Watchlist"}
                watchlists={watchlists}
                activeWatchlistId={activeWatchlistId}
                onCreate={createWatchlist}
                onRename={renameActiveWatchlist}
                onDelete={deleteActiveWatchlist}
                onSwitch={switchWatchlist}
                variant="rail-title"
                className="min-w-0"
                titleClassName="gap-1 pl-0 text-[15px] leading-6 text-fg"
                ready={watchlistReady}
                countBadge={activeWatchlistBadge}
              />
            </div>
          )}
          <div className="flex shrink-0 items-center gap-0.5">
            <Link
              href="/watchlist"
              aria-label="Open full watchlist"
              className="flex size-8 items-center justify-center rounded-full text-fg-muted transition-colors hover:bg-surface-muted hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fg/15"
            >
              <Maximize2 className="size-4" strokeWidth={2} aria-hidden />
            </Link>
            {singleWatchlist ? (
              <WatchlistOptionsMenu
                name={activeWatchlistName || "My watchlist"}
                watchlists={watchlists}
                activeWatchlistId={activeWatchlistId}
                onCreate={createWatchlist}
                onRename={renameActiveWatchlist}
                onDelete={deleteActiveWatchlist}
                onSwitch={switchWatchlist}
                variant="more-icon"
                ready={watchlistReady}
              />
            ) : null}
            <WatchlistRailHideButton onHide={hideWatchlist} />
          </div>
        </div>

        <div className="flex min-h-0 flex-col overflow-hidden">
          <OverlayScrollArea edgeFade>
            <WatchlistRailScrollContent
              showLoadingState={!watchlistReady || awaitingServerList || (loading && items.length === 0)}
              empty={empty}
              error={error}
              rows={items}
              watchedTickers={watchedTickers}
              pathname="/home"
              tabParam={null}
              pricesLoading={pricesLoading}
              loading={loading}
              moveActiveWatchlistItem={moveActiveWatchlistItem}
              removeFromActiveWatchlist={removeFromActiveWatchlist}
            />
          </OverlayScrollArea>
        </div>
      </section>
    </div>
  );
}
