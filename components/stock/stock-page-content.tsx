"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { ChartDisplayState } from "@/components/chart/PriceChart";
import { PriceChart } from "@/components/chart/PriceChart";
import type { StockDetailHeaderMeta } from "@/lib/market/stock-header-meta";
import { chartingMetricToParam, type ChartingMetricId } from "@/lib/market/stock-charting-metrics";
import { StockDetailTabNav, type StockDetailTabId } from "./stock-detail-tab-nav";
import { StockChartingTab } from "./stock-charting-tab";
import { StockProfileTab } from "./stock-profile-tab";
import { StockHeader } from "./stock-header";
import { ChartControls } from "./chart-controls";
import { MiniTable } from "./mini-table";
import { KeyStats } from "./key-stats";
import { LatestNews } from "./latest-news";
import type { StockChartRange } from "@/lib/market/stock-chart-types";
import { WATCHLIST_MUTATED_EVENT } from "@/lib/watchlist/constants";

function parseStockHeaderMetaPayload(json: {
  sector?: unknown;
  industry?: unknown;
  earningsDateDisplay?: unknown;
  watchlistCount?: unknown;
}): StockDetailHeaderMeta {
  return {
    sector: typeof json.sector === "string" ? json.sector : null,
    industry: typeof json.industry === "string" ? json.industry : null,
    earningsDateDisplay: typeof json.earningsDateDisplay === "string" ? json.earningsDateDisplay : null,
    watchlistCount: typeof json.watchlistCount === "number" ? json.watchlistCount : null,
  };
}

function tabFromSearchParam(raw: string | null): StockDetailTabId | null {
  if (raw === "overview" || raw === "charting" || raw === "profile") return raw;
  return null;
}

export function StockPageContent({ routeTicker }: { routeTicker?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const prevTickerRef = useRef<string | null>(null);

  const [range, setRange] = useState<StockChartRange>("1Y");
  const ticker = (routeTicker?.trim() ? routeTicker.trim() : "AAPL").toUpperCase();

  const activeTab: StockDetailTabId = tabFromSearchParam(searchParams.get("tab")) ?? "overview";
  const chartingMetricParam = searchParams.get("metric");

  const [headerMeta, setHeaderMeta] = useState<StockDetailHeaderMeta | null>(null);
  const [headerMetaLoading, setHeaderMetaLoading] = useState(true);

  const refetchHeaderMeta = useCallback(async () => {
    setHeaderMetaLoading(true);
    try {
      const res = await fetch(`/api/stocks/${encodeURIComponent(ticker)}/header-meta`, { cache: "no-store" });
      if (!res.ok) {
        setHeaderMeta(null);
        return;
      }
      const json = (await res.json()) as Parameters<typeof parseStockHeaderMetaPayload>[0];
      setHeaderMeta(parseStockHeaderMetaPayload(json));
    } catch {
      setHeaderMeta(null);
    } finally {
      setHeaderMetaLoading(false);
    }
  }, [ticker]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setHeaderMetaLoading(true);
      try {
        const res = await fetch(`/api/stocks/${encodeURIComponent(ticker)}/header-meta`, { cache: "no-store" });
        if (!res.ok) {
          if (!cancelled) setHeaderMeta(null);
          return;
        }
        const json = (await res.json()) as Parameters<typeof parseStockHeaderMetaPayload>[0];
        if (cancelled) return;
        setHeaderMeta(parseStockHeaderMetaPayload(json));
      } catch {
        if (!cancelled) setHeaderMeta(null);
      } finally {
        if (!cancelled) setHeaderMetaLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [ticker]);

  useEffect(() => {
    const onMut = (e: Event) => {
      const t = (e as CustomEvent<{ ticker?: string }>).detail?.ticker?.trim().toUpperCase();
      if (t && t === ticker) void refetchHeaderMeta();
    };
    window.addEventListener(WATCHLIST_MUTATED_EVENT, onMut);
    return () => window.removeEventListener(WATCHLIST_MUTATED_EVENT, onMut);
  }, [ticker, refetchHeaderMeta]);

  useEffect(() => {
    if (prevTickerRef.current === null) {
      prevTickerRef.current = ticker;
      return;
    }
    if (prevTickerRef.current !== ticker) {
      prevTickerRef.current = ticker;
      router.replace(pathname, { scroll: false });
    }
  }, [ticker, pathname, router]);

  const setTabInUrl = useCallback(
    (tab: StockDetailTabId) => {
      const params = new URLSearchParams(searchParams.toString());
      if (tab === "overview") {
        params.delete("tab");
        params.delete("metric");
      } else {
        params.set("tab", tab);
        if (tab !== "charting") params.delete("metric");
      }
      const q = params.toString();
      router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const openChartingWithMetric = useCallback(
    (id: ChartingMetricId) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("tab", "charting");
      params.set("metric", chartingMetricToParam(id));
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const [chartUi, setChartUi] = useState<ChartDisplayState>({
    loading: true,
    empty: true,
    displayPrice: null,
    displayChangePct: null,
    displayChangeAbs: null,
    isHovering: false,
    selectionActive: false,
    periodLabelOverride: null,
    priceTimestampLabel: null,
  });

  const onChartDisplay = useCallback((s: ChartDisplayState) => {
    setChartUi(s);
  }, []);

  return (
    <div className="space-y-5 px-9 py-6">
      <StockHeader
        ticker={ticker}
        periodLabel={range}
        periodLabelOverride={chartUi.periodLabelOverride}
        price={chartUi.displayPrice}
        changePct={chartUi.displayChangePct}
        changeAbs={chartUi.displayChangeAbs}
        chartLoading={chartUi.loading}
        chartEmpty={chartUi.empty}
        priceTimestampLabel={chartUi.priceTimestampLabel}
        chartHovering={chartUi.isHovering && !chartUi.selectionActive}
        headerMeta={headerMeta}
        headerMetaLoading={headerMetaLoading}
      />

      <StockDetailTabNav activeTab={activeTab} onTabChange={setTabInUrl} />

      {activeTab === "overview" ? (
        <>
          <ChartControls activeRange={range} onRangeChange={setRange} />
          <PriceChart kind="stock" symbol={ticker} range={range} onDisplayChange={onChartDisplay} />
          <MiniTable ticker={ticker} />
          <div className="pt-2">
            <KeyStats ticker={ticker} onRevenueProfitMetricClick={openChartingWithMetric} />
          </div>
          <div className="pt-2">
            <LatestNews ticker={ticker} />
          </div>
        </>
      ) : activeTab === "charting" ? (
        <StockChartingTab ticker={ticker} metricParam={chartingMetricParam} />
      ) : (
        <StockProfileTab ticker={ticker} />
      )}
    </div>
  );
}
