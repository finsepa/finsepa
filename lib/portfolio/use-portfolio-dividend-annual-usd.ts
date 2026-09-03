"use client";

import { useEffect, useMemo, useState } from "react";

import type { PortfolioHolding } from "@/components/portfolio/portfolio-types";
import { portfolioDividendIncome } from "@/lib/portfolio/portfolio-dividend-income";

const OVERVIEW_SESSION_TTL_MS = 5 * 60_000;

export type PortfolioDividendIncomeState = {
  annualUsd: number | null;
  yieldPct: number | null;
};

const EMPTY: PortfolioDividendIncomeState = { annualUsd: null, yieldPct: null };

/**
 * Estimated annual dividend income + portfolio yield (overview-market yields × holdings).
 * Reuses the same overview-market session cache as portfolio overview cards.
 */
export function usePortfolioDividendAnnualUsd(
  holdings: readonly PortfolioHolding[],
): PortfolioDividendIncomeState {
  const [state, setState] = useState<PortfolioDividendIncomeState>(EMPTY);

  const symbolsKey = useMemo(() => {
    const syms = [...new Set(holdings.map((h) => h.symbol.trim().toUpperCase()).filter(Boolean))].sort();
    return syms.length > 0 ? syms.join(",") : "";
  }, [holdings]);

  useEffect(() => {
    if (!symbolsKey) {
      setState(EMPTY);
      return;
    }

    let cancelled = false;
    const sessionKey = `finsepa.portfolio.overviewMarket.v2.${symbolsKey}`;

    async function load() {
      try {
        const raw = sessionStorage.getItem(sessionKey);
        if (raw) {
          const parsed = JSON.parse(raw) as {
            at: number;
            data: { yieldBySymbol: Record<string, number | null> };
          } | null;
          if (parsed && typeof parsed.at === "number" && Date.now() - parsed.at < OVERVIEW_SESSION_TTL_MS) {
            const fromCache = portfolioDividendIncome(holdings, parsed.data.yieldBySymbol ?? {});
            if (!cancelled) setState(fromCache);
            return;
          }
        }
      } catch {
        /* ignore */
      }

      try {
        const res = await fetch("/api/portfolio/overview-market", {
          method: "POST",
          credentials: "include",
          cache: "no-store",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            symbols: symbolsKey.split(","),
            inceptionYmd: null,
            inceptionPriceTickers: [],
          }),
        });
        if (!res.ok) {
          if (!cancelled) setState(EMPTY);
          return;
        }
        const data = (await res.json()) as { yieldBySymbol: Record<string, number | null> };
        const fromApi = portfolioDividendIncome(holdings, data.yieldBySymbol ?? {});
        if (!cancelled) setState(fromApi);
      } catch {
        if (!cancelled) setState(EMPTY);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [symbolsKey, holdings]);

  return state;
}
