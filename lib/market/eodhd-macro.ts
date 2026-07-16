import "server-only";

import { unstable_cache } from "next/cache";

import { REVALIDATE_STATIC_DAY } from "@/lib/data/cache-policy";

import { getEodhdApiKey } from "@/lib/env/server";
import { fetchBlsCpiIndexSeriesCached } from "@/lib/market/bls-cpi-macro";
import { fetchCpiYoyInflationSeriesCached } from "@/lib/market/cpi-inflation-macro";
import { fetchGdpDeflatorYoySeriesCached } from "@/lib/market/gdp-deflator-macro";
import { fetchFredDebtPctGdpSeriesCached, fetchFredGdpSeriesCached, fetchFredGdpGrowthYoySeriesCached, fetchFredGdpPerCapitaSeriesCached } from "@/lib/market/fred-gdp-macro";
import { fetchFredUnrateSeriesCached } from "@/lib/market/fred-unemployment-macro";
import { fetchCryptoFearGreedMacroSeriesCached } from "@/lib/market/alternative-fear-greed";
import { fetchShillerIeMacroSeriesCached, type ShillerIeMacroMetric } from "@/lib/market/shiller-ie-macro";
import { fetchFedFundsTargetSeriesCached } from "@/lib/market/eodhd-fed-funds-macro";
import { fetchUstParYieldTenorCached } from "@/lib/market/eodhd-ust-par-yield";
import { traceEodhdHttp } from "@/lib/market/provider-trace";

export type MacroPoint = { time: string; value: number };

export type MacroSeriesKind = "percent" | "usd" | "index" | "number";

/** Indicator codes accepted by EODHD `macro-indicator` for USA (see their macro docs). */
export type MacroIndicatorCode =
  | "inflation_consumer_prices_annual"
  | "consumer_price_index"
  | "unemployment_total_percent"
  | "gdp_current_usd"
  | "gdp_growth_annual"
  | "gdp_per_capita_usd"
  | "inflation_gdp_deflator_annual"
  | "debt_percent_gdp";

export type MacroSeriesDef =
  | {
      id: string;
      title: string;
      kind: MacroSeriesKind;
      provider: { type: "macro_indicator"; indicator: MacroIndicatorCode };
    }
  | {
      id: string;
      title: string;
      kind: MacroSeriesKind;
      provider: { type: "ust_par_yield"; tenor: "10Y" | "20Y" };
    }
  | {
      id: string;
      title: string;
      kind: MacroSeriesKind;
      provider: { type: "shiller_ie"; metric: ShillerIeMacroMetric };
    }
  | {
      id: string;
      title: string;
      kind: MacroSeriesKind;
      /** FRED monthly Effective Federal Funds Rate (`FEDFUNDS`). Type id kept for compatibility. */
      provider: { type: "fed_funds_fomc" };
    }
  | {
      id: string;
      title: string;
      kind: MacroSeriesKind;
      /** Quarterly nominal US GDP (FRED GDP, SAAR). */
      provider: { type: "fred_gdp" };
    }
  | {
      id: string;
      title: string;
      kind: MacroSeriesKind;
      /** Quarterly real US GDP growth — YoY % from FRED GDPC1. */
      provider: { type: "fred_gdp_growth_yoy" };
    }
  | {
      id: string;
      title: string;
      kind: MacroSeriesKind;
      /** Quarterly nominal US GDP per capita (FRED A939RC0Q052SBEA). */
      provider: { type: "fred_gdp_per_capita" };
    }
  | {
      id: string;
      title: string;
      kind: MacroSeriesKind;
      /** Quarterly US federal debt as % of GDP (FRED GFDEGDQ188S). */
      provider: { type: "fred_debt_pct_gdp" };
    }
  | {
      id: string;
      title: string;
      kind: MacroSeriesKind;
      /** Monthly US unemployment rate (FRED UNRATE). */
      provider: { type: "fred_unrate" };
    }
  | {
      id: string;
      title: string;
      kind: MacroSeriesKind;
      /** Quarterly US GDP deflator inflation — YoY % from FRED GDPDEF index. */
      provider: { type: "gdp_deflator_yoy" };
    }
  | {
      id: string;
      title: string;
      kind: MacroSeriesKind;
      /** Monthly US inflation — 12-month CPI change (Shiller history + BLS CPI-U). */
      provider: { type: "cpi_yoy_inflation" };
    }
  | {
      id: string;
      title: string;
      kind: MacroSeriesKind;
      /** Monthly BLS CPI-U rebased to 2010 = 100 (World Bank macro card scale). */
      provider: { type: "bls_cpi_index" };
    }
  | {
      id: string;
      title: string;
      kind: MacroSeriesKind;
      /** Alternative.me Crypto Fear & Greed Index (0–100). */
      provider: { type: "crypto_fear_greed" };
    };

/**
 * Macro dashboard series — EODHD macro indicators + Treasury yields
 * (`US10Y.GBOND` EOD; 20Y from `/ust/yield-rates` year filters)
 * + Shiller `ie_data.xls` valuation metrics (classic CAPE extended with live SPX + BLS CPI)
 * + monthly US inflation (12-month CPI change — Shiller + BLS, Multpl-style)
 * + quarterly GDP deflator inflation (YoY from FRED GDPDEF)
 * + quarterly nominal GDP (FRED GDP)
 * + quarterly real GDP growth (YoY from FRED GDPC1)
 * + quarterly GDP per capita (FRED A939RC0Q052SBEA)
 * + quarterly federal debt as % of GDP (FRED GFDEGDQ188S)
 * + monthly unemployment rate (FRED UNRATE)
 * + Alternative.me Crypto Fear & Greed Index.
 *
 * @see https://eodhd.com/financial-apis/macroeconomics-data-and-macro-indicators-api
 * @see https://eodhd.com/financial-apis/us-treasury-ust-interest-rates-api-beta
 * @see http://www.econ.yale.edu/~shiller/data.htm
 */
export const MACRO_SERIES: MacroSeriesDef[] = [
  { id: "shiller_pe", title: "Shiller P/E", kind: "number", provider: { type: "shiller_ie", metric: "shiller_cape" } },
  { id: "sp500_earnings", title: "S&P 500 Earnings", kind: "number", provider: { type: "shiller_ie", metric: "sp500_earnings" } },
  { id: "sp500_trailing_pe", title: "S&P 500 P/E", kind: "number", provider: { type: "shiller_ie", metric: "sp500_pe" } },
  { id: "ust_par_yield_10y", title: "10-Year Treasury", kind: "percent", provider: { type: "ust_par_yield", tenor: "10Y" } },
  { id: "ust_par_yield_20y", title: "20-Year Treasury", kind: "percent", provider: { type: "ust_par_yield", tenor: "20Y" } },
  { id: "fed_interest_rate", title: "Fed funds rate", kind: "percent", provider: { type: "fed_funds_fomc" } },
  { id: "inflation_consumer_prices_annual", title: "Inflation", kind: "percent", provider: { type: "cpi_yoy_inflation" } },
  { id: "inflation_gdp_deflator_annual", title: "GDP deflator", kind: "percent", provider: { type: "gdp_deflator_yoy" } },
  { id: "consumer_price_index", title: "Consumer Price Index", kind: "index", provider: { type: "bls_cpi_index" } },
  { id: "gdp_growth_annual", title: "GDP Growth", kind: "percent", provider: { type: "fred_gdp_growth_yoy" } },
  { id: "gdp_current_usd", title: "GDP", kind: "usd", provider: { type: "fred_gdp" } },
  { id: "gdp_per_capita_usd", title: "GDP per capita", kind: "usd", provider: { type: "fred_gdp_per_capita" } },
  { id: "unemployment_total_percent", title: "Unemployment Rate", kind: "percent", provider: { type: "fred_unrate" } },
  { id: "debt_percent_gdp", title: "Debt", kind: "percent", provider: { type: "fred_debt_pct_gdp" } },
  { id: "crypto_fear_greed", title: "Crypto Fear & Greed", kind: "number", provider: { type: "crypto_fear_greed" } },
];

function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim()) {
    const n = Number(v.replace(/,/g, ""));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

async function fetchMacroIndicatorUncached(args: {
  country: string; // ISO-3166 alpha-3, e.g. "USA"
  indicator: MacroIndicatorCode;
}): Promise<MacroPoint[]> {
  const key = getEodhdApiKey();
  if (!key) return [];

  const params = new URLSearchParams({
    api_token: key,
    fmt: "json",
    indicator: args.indicator,
  });

  const url = `https://eodhd.com/api/macro-indicator/${encodeURIComponent(args.country)}?${params.toString()}`;
  try {
    if (!traceEodhdHttp("fetchMacroIndicatorUncached", { country: args.country, indicator: args.indicator }))
      return [];
    const res = await fetch(url, { next: { revalidate: REVALIDATE_STATIC_DAY } });
    if (!res.ok) return [];
    const json = (await res.json()) as unknown;
    if (!Array.isArray(json)) return [];

    const out: MacroPoint[] = [];
    for (const r of json) {
      if (!r || typeof r !== "object") continue;
      const row = r as { date?: unknown; value?: unknown; Date?: unknown; Value?: unknown };
      const rawDate = typeof row.date === "string" ? row.date : typeof row.Date === "string" ? row.Date : "";
      const time = rawDate ? rawDate.trim().slice(0, 10) : "";
      const value = num(row.value ?? row.Value);
      if (!time || value == null) continue;
      out.push({ time, value });
    }

    out.sort((a, b) => a.time.localeCompare(b.time));
    return out;
  } catch {
    return [];
  }
}

const fetchMacroIndicatorCached = unstable_cache(fetchMacroIndicatorUncached, ["eodhd-macro-indicator-v4"], {
  revalidate: REVALIDATE_STATIC_DAY,
});

/** Full history for the series (sorted ascending). Range windows are applied in the UI. */
export async function fetchMacroSeriesAll(country: string, def: MacroSeriesDef): Promise<MacroPoint[]> {
  if (def.provider.type === "ust_par_yield") {
    return fetchUstParYieldTenorCached(def.provider.tenor);
  }
  if (def.provider.type === "shiller_ie") {
    return fetchShillerIeMacroSeriesCached(def.provider.metric);
  }
  if (def.provider.type === "fed_funds_fomc") {
    return fetchFedFundsTargetSeriesCached();
  }
  if (def.provider.type === "bls_cpi_index") {
    return fetchBlsCpiIndexSeriesCached();
  }
  if (def.provider.type === "cpi_yoy_inflation") {
    return fetchCpiYoyInflationSeriesCached();
  }
  if (def.provider.type === "gdp_deflator_yoy") {
    return fetchGdpDeflatorYoySeriesCached();
  }
  if (def.provider.type === "fred_gdp") {
    return fetchFredGdpSeriesCached();
  }
  if (def.provider.type === "fred_gdp_growth_yoy") {
    return fetchFredGdpGrowthYoySeriesCached();
  }
  if (def.provider.type === "fred_gdp_per_capita") {
    return fetchFredGdpPerCapitaSeriesCached();
  }
  if (def.provider.type === "fred_debt_pct_gdp") {
    return fetchFredDebtPctGdpSeriesCached();
  }
  if (def.provider.type === "fred_unrate") {
    return fetchFredUnrateSeriesCached();
  }
  if (def.provider.type === "crypto_fear_greed") {
    return fetchCryptoFearGreedMacroSeriesCached();
  }
  return fetchMacroIndicatorCached({ country, indicator: def.provider.indicator });
}
