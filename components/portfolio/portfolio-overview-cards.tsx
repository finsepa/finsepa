"use client";

import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { parse } from "date-fns";
import { ChevronDown } from "lucide-react";

import type { PortfolioHolding, PortfolioTransaction } from "@/components/portfolio/portfolio-types";
import {
  earliestStockBuyYmd,
  modifiedDietzReturnPct,
  netCashIntoEquityAfter,
  replayStockSharesUpTo,
} from "@/lib/portfolio/benchmark-inception";
import {
  equityMarketValue,
  netCashUsd,
  totalCostBasisInvested,
  totalNetWorth,
  unrealizedProfitPct,
  unrealizedProfitUsd,
} from "@/lib/portfolio/overview-metrics";
import type { OverviewProfitPeriod } from "@/lib/portfolio/overview-market-types";
import { pickPerformancePct } from "@/lib/portfolio/overview-market-types";
import type { StockPerformance } from "@/lib/market/stock-performance-types";
import { cn } from "@/lib/utils";

const SPY_BENCHMARK = "SPY";

const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const pctFmt = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const PERIOD_OPTIONS: { id: OverviewProfitPeriod; label: string }[] = [
  { id: "all", label: "All time" },
  { id: "m1", label: "1M" },
  { id: "ytd", label: "YTD" },
  { id: "y1", label: "1Y" },
  { id: "y5", label: "5Y" },
];

async function fetchPerformance(sym: string): Promise<StockPerformance | null> {
  try {
    const res = await fetch(`/api/stocks/${encodeURIComponent(sym)}/performance`);
    if (!res.ok) return null;
    return (await res.json()) as StockPerformance;
  } catch {
    return null;
  }
}

async function fetchDividendYieldPct(sym: string): Promise<number | null> {
  try {
    const res = await fetch(`/api/stocks/${encodeURIComponent(sym)}/key-stats-dividends`);
    if (!res.ok) return null;
    const data = (await res.json()) as { rows?: { label: string; value: string }[] | null };
    const row = data.rows?.find((r) => r.label.toLowerCase().includes("yield"));
    if (!row?.value) return null;
    const m = row.value.match(/([\d.]+)/);
    if (!m) return null;
    const n = Number.parseFloat(m[1]!);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

async function fetchPriceOnDate(sym: string, ymd: string): Promise<number | null> {
  try {
    const res = await fetch(
      `/api/stocks/${encodeURIComponent(sym)}/price-on-date?date=${encodeURIComponent(ymd)}`,
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { price?: number | null };
    return typeof data.price === "number" && Number.isFinite(data.price) ? data.price : null;
  } catch {
    return null;
  }
}

/**
 * Weighted average of per-asset returns using current market value weights (equity only).
 */
function weightedPortfolioReturn(
  holdings: PortfolioHolding[],
  getReturn: (sym: string) => number | null,
): number | null {
  let num = 0;
  let denom = 0;
  for (const h of holdings) {
    const r = getReturn(h.symbol.toUpperCase());
    if (r == null || !Number.isFinite(r)) continue;
    num += h.currentValue * r;
    denom += h.currentValue;
  }
  if (denom <= 0) return null;
  return num / denom;
}

function PortfolioOverviewCardsInner({
  holdings,
  transactions,
}: {
  holdings: PortfolioHolding[];
  transactions: PortfolioTransaction[];
}) {
  const cash = useMemo(() => netCashUsd(transactions), [transactions]);
  const netWorth = useMemo(() => totalNetWorth(holdings, cash), [holdings, cash]);
  const invested = useMemo(() => totalCostBasisInvested(holdings), [holdings]);
  const profitAllUsd = useMemo(() => unrealizedProfitUsd(holdings), [holdings]);
  const profitAllPct = useMemo(() => unrealizedProfitPct(holdings), [holdings]);

  const equity = useMemo(() => equityMarketValue(holdings), [holdings]);

  const inceptionYmd = useMemo(() => earliestStockBuyYmd(transactions), [transactions]);
  const netFlowAfterInception = useMemo(
    () => (inceptionYmd != null ? netCashIntoEquityAfter(transactions, inceptionYmd) : 0),
    [transactions, inceptionYmd],
  );

  const inceptionDateLabel = useMemo(() => {
    if (!inceptionYmd) return null;
    const d = parse(inceptionYmd, "yyyy-MM-dd", new Date());
    return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(d);
  }, [inceptionYmd]);

  const [period, setPeriod] = useState<OverviewProfitPeriod>("all");
  const [loading, setLoading] = useState(false);
  const [perfBySymbol, setPerfBySymbol] = useState<Record<string, StockPerformance | null>>({});
  const [spyPerf, setSpyPerf] = useState<StockPerformance | null>(null);
  const [yieldBySymbol, setYieldBySymbol] = useState<Record<string, number | null>>({});
  /** Equity value at end of first investment day (replay × prices on that day). */
  const [inceptionEquityV0, setInceptionEquityV0] = useState<number | null>(null);
  const [inceptionSpyPrice0, setInceptionSpyPrice0] = useState<number | null>(null);

  const symbols = useMemo(
    () => [...new Set(holdings.map((h) => h.symbol.toUpperCase()))],
    [holdings],
  );

  const loadMarket = useCallback(async () => {
    if (symbols.length === 0) {
      setPerfBySymbol({});
      setSpyPerf(null);
      setYieldBySymbol({});
      setInceptionEquityV0(null);
      setInceptionSpyPrice0(null);
      return;
    }
    setLoading(true);
    try {
      const [spy, ...rest] = await Promise.all([
        fetchPerformance(SPY_BENCHMARK),
        ...symbols.map((s) => fetchPerformance(s)),
      ]);
      setSpyPerf(spy);
      const map: Record<string, StockPerformance | null> = {};
      symbols.forEach((s, i) => {
        map[s] = rest[i] ?? null;
      });
      setPerfBySymbol(map);

      const yields = await Promise.all(symbols.map((s) => fetchDividendYieldPct(s)));
      const ym: Record<string, number | null> = {};
      symbols.forEach((s, i) => {
        ym[s] = yields[i] ?? null;
      });
      setYieldBySymbol(ym);

      const startYmd = earliestStockBuyYmd(transactions);
      let v0: number | null = null;
      let spy0: number | null = null;
      if (startYmd) {
        const sharesMap = replayStockSharesUpTo(transactions, startYmd);
        const syms = [...sharesMap.entries()]
          .filter(([, sh]) => sh > 0)
          .map(([s]) => s);
        if (syms.length > 0) {
          const [spyAtInception, ...stockAtInception] = await Promise.all([
            fetchPriceOnDate(SPY_BENCHMARK, startYmd),
            ...syms.map((s) => fetchPriceOnDate(s, startYmd)),
          ]);
          spy0 = spyAtInception;
          let sum = 0;
          for (let i = 0; i < syms.length; i++) {
            const p = stockAtInception[i];
            const sh = sharesMap.get(syms[i]!) ?? 0;
            if (p != null && Number.isFinite(p) && sh > 0) sum += sh * p;
          }
          v0 = sum > 0 ? sum : null;
        }
      }
      setInceptionEquityV0(v0);
      setInceptionSpyPrice0(spy0);
    } finally {
      setLoading(false);
    }
  }, [symbols, transactions]);

  useEffect(() => {
    void loadMarket();
  }, [loadMarket]);

  const weightedPeriodPct = useMemo(() => {
    if (period === "all") return null;
    return weightedPortfolioReturn(holdings, (sym) => {
      const p = perfBySymbol[sym];
      return pickPerformancePct(p, period);
    });
  }, [holdings, perfBySymbol, period]);

  /**
   * Portfolio return vs S&P 500 (SPY) over the **same** window: from your first stock purchase
   * through today. Uses Modified Dietz when you add capital after that day.
   */
  const benchmarkDiffPct = useMemo(() => {
    if (
      inceptionEquityV0 == null ||
      inceptionEquityV0 <= 0 ||
      inceptionSpyPrice0 == null ||
      inceptionSpyPrice0 <= 0
    ) {
      return null;
    }
    const spyNow = spyPerf?.price ?? null;
    if (spyNow == null || !Number.isFinite(spyNow) || spyNow <= 0) return null;

    const rPort = modifiedDietzReturnPct(inceptionEquityV0, equity, netFlowAfterInception);
    if (rPort == null) return null;
    const rSpy = ((spyNow / inceptionSpyPrice0) - 1) * 100;
    return rPort - rSpy;
  }, [
    inceptionEquityV0,
    inceptionSpyPrice0,
    equity,
    netFlowAfterInception,
    spyPerf?.price,
  ]);

  const profitDisplayUsd = useMemo(() => {
    if (period === "all") return profitAllUsd;
    if (weightedPeriodPct == null || equity <= 0) return null;
    return (equity * weightedPeriodPct) / 100;
  }, [period, profitAllUsd, weightedPeriodPct, equity]);

  const profitDisplayPct = useMemo(() => {
    if (period === "all") return profitAllPct;
    return weightedPeriodPct;
  }, [period, profitAllPct, weightedPeriodPct]);

  const dividendWeightedYield = useMemo(() => {
    if (equity <= 0) return null;
    let num = 0;
    let denom = 0;
    for (const h of holdings) {
      const sym = h.symbol.toUpperCase();
      const y = yieldBySymbol[sym];
      if (y == null || !Number.isFinite(y)) continue;
      num += h.currentValue * y;
      denom += h.currentValue;
    }
    if (denom <= 0) return null;
    return num / denom;
  }, [holdings, yieldBySymbol, equity]);

  const dividendAnnualUsd = useMemo(() => {
    if (equity <= 0) return null;
    let sum = 0;
    let any = false;
    for (const h of holdings) {
      const sym = h.symbol.toUpperCase();
      const y = yieldBySymbol[sym];
      if (y == null || !Number.isFinite(y)) continue;
      any = true;
      sum += h.currentValue * (y / 100);
    }
    return any ? sum : null;
  }, [holdings, yieldBySymbol, equity]);

  return (
    <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
      {/* Value */}
      <div
        className={cn(
          "rounded-xl border border-[#E4E4E7] bg-white p-5 shadow-[0px_1px_2px_0px_rgba(10,10,10,0.04)]",
          loading && "opacity-80",
        )}
      >
        <p className="text-xs font-medium text-[#71717A]">Value</p>
        <p className="mt-2 text-2xl font-semibold tabular-nums tracking-tight text-[#09090B]">
          {usd.format(netWorth)}
        </p>
        <p className="mt-2 text-sm text-[#71717A]">{usd.format(invested)} invested</p>
      </div>

      {/* Total profit */}
      <div
        className={cn(
          "rounded-xl border border-[#E4E4E7] bg-white p-5 shadow-[0px_1px_2px_0px_rgba(10,10,10,0.04)]",
          loading && "opacity-80",
        )}
      >
        <p className="text-xs font-medium text-[#71717A]">Total profit</p>
        <p
          className={cn(
            "mt-2 text-2xl font-semibold tabular-nums tracking-tight",
            (profitDisplayUsd ?? 0) >= 0 ? "text-[#16A34A]" : "text-[#DC2626]",
          )}
        >
          {profitDisplayUsd != null
            ? `${profitDisplayUsd >= 0 ? "+" : ""}${usd.format(profitDisplayUsd)}`
            : "—"}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span
            className={cn(
              "text-sm font-medium tabular-nums",
              (profitDisplayPct ?? 0) >= 0 ? "text-[#16A34A]" : "text-[#DC2626]",
            )}
          >
            {profitDisplayPct != null
              ? `${profitDisplayPct >= 0 ? "+" : ""}${pctFmt.format(profitDisplayPct)}%`
              : "—"}
          </span>
          <div className="relative inline-flex items-center gap-0.5 rounded-md border border-[#E4E4E7] bg-[#FAFAFA] px-1.5 py-0.5">
            <select
              aria-label="Profit period"
              value={period}
              onChange={(e) => setPeriod(e.target.value as OverviewProfitPeriod)}
              className="cursor-pointer bg-transparent pr-5 text-xs font-medium text-[#09090B] outline-none"
            >
              {PERIOD_OPTIONS.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-1 h-3.5 w-3.5 text-[#71717A]" aria-hidden />
          </div>
        </div>
      </div>

      {/* Benchmark */}
      <div
        className={cn(
          "rounded-xl border border-[#E4E4E7] bg-white p-5 shadow-[0px_1px_2px_0px_rgba(10,10,10,0.04)]",
          loading && "opacity-80",
        )}
      >
        <p className="text-xs font-medium text-[#71717A]">Benchmark</p>
        <p
          className={cn(
            "mt-2 text-2xl font-semibold tabular-nums tracking-tight",
            benchmarkDiffPct == null
              ? "text-[#09090B]"
              : benchmarkDiffPct >= 0
                ? "text-[#16A34A]"
                : "text-[#DC2626]",
          )}
        >
          {benchmarkDiffPct != null
            ? `${benchmarkDiffPct >= 0 ? "+" : ""}${pctFmt.format(benchmarkDiffPct)}%`
            : "—"}
        </p>
        <p className="mt-2 text-sm leading-snug text-[#71717A]">
          {benchmarkDiffPct == null
            ? "Add a buy transaction to compare vs S&P 500 (SPY) from your start date"
            : (
                <>
                  {benchmarkDiffPct >= 0
                    ? "Portfolio is ahead of S&P 500"
                    : "Portfolio trails S&P 500"}
                  {inceptionDateLabel ? ` · since ${inceptionDateLabel}` : ""}
                </>
              )}
        </p>
      </div>

      {/* Dividends */}
      <div
        className={cn(
          "rounded-xl border border-[#E4E4E7] bg-white p-5 shadow-[0px_1px_2px_0px_rgba(10,10,10,0.04)]",
          loading && "opacity-80",
        )}
      >
        <p className="text-xs font-medium text-[#71717A]">Dividends</p>
        <p className="mt-2 text-2xl font-semibold tabular-nums tracking-tight text-[#09090B]">
          {dividendWeightedYield != null ? `${pctFmt.format(dividendWeightedYield)}%` : "—"}
        </p>
        <p className="mt-2 text-sm text-[#71717A]">
          {dividendAnnualUsd != null ? `${usd.format(dividendAnnualUsd)} annually` : "No dividend data"}
        </p>
      </div>
    </div>
  );
}

export const PortfolioOverviewCards = memo(PortfolioOverviewCardsInner);
