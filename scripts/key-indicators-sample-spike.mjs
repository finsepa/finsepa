#!/usr/bin/env node
/**
 * Read-only spike: compute candidate Key Indicators for 10 sample tickers from EODHD.
 * Usage: node --env-file=.env.local scripts/key-indicators-sample-spike.mjs
 */

const SAMPLES = [
  { ticker: "AAPL", note: "Mega-cap tech" },
  { ticker: "NVDA", note: "High-growth semi" },
  { ticker: "BRK-B", note: "Class-B shares" },
  { ticker: "SPY", note: "ETF (edge case)" },
  { ticker: "TSLA", note: "Volatile growth" },
  { ticker: "JPM", note: "Large bank" },
  { ticker: "AMD", note: "Semi cyclical" },
  { ticker: "KO", note: "Dividend staple" },
  { ticker: "MU", note: "Memory cyclical" },
  { ticker: "PLTR", note: "Newer high-multiple" },
];

const BENCHMARK = "GSPC.INDX";

function toEodhdUs(ticker) {
  return `${ticker.trim().toUpperCase().replace(/\./g, "-")}.US`;
}

function toEodhdSymbol(ticker) {
  const s = ticker.trim().toUpperCase();
  if (s.includes(".") && /\.(INDX|US|CC)$/i.test(s)) return s;
  return toEodhdUs(s);
}

function num(v) {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim()) {
    const n = Number(v.replace(/,/g, ""));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function firstNum(obj, keys) {
  if (!obj) return null;
  for (const k of keys) {
    const n = num(obj[k]);
    if (n != null) return n;
  }
  return null;
}

function pctChange(cur, base) {
  if (cur == null || base == null || base === 0) return null;
  return ((cur - base) / base) * 100;
}

function fmtPct(n, digits = 2) {
  if (n == null || !Number.isFinite(n)) return null;
  return `${n >= 0 ? "" : ""}${n.toFixed(digits)}%`;
}

function fmtUsd(n) {
  if (n == null || !Number.isFinite(n)) return null;
  return `$${n.toFixed(2)}`;
}

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url.slice(0, 80)}…`);
  return res.json();
}

async function fetchEodDaily(symbol, from, to) {
  const key = process.env.EODHD_API_KEY?.trim();
  const params = new URLSearchParams({ api_token: key, fmt: "json", from, to });
  const url = `https://eodhd.com/api/eod/${encodeURIComponent(symbol)}?${params}`;
  const data = await fetchJson(url);
  if (!Array.isArray(data)) return [];
  return data
    .map((r) => ({
      date: r.date,
      close: num(r.adjusted_close) ?? num(r.close),
    }))
    .filter((b) => b.date && b.close != null)
    .sort((a, b) => a.date.localeCompare(b.date));
}

function ytdFromBars(bars, year = new Date().getUTCFullYear()) {
  if (!bars.length) return null;
  const last = bars[bars.length - 1].close;
  const ytdBar = bars.find((b) => b.date >= `${year}-01-01`);
  return pctChange(last, ytdBar?.close ?? null);
}

async function fetchFundamentals(ticker) {
  const key = process.env.EODHD_API_KEY?.trim();
  const sym = toEodhdSymbol(ticker);
  const url = `https://eodhd.com/api/fundamentals/${encodeURIComponent(sym)}?api_token=${encodeURIComponent(key)}&fmt=json`;
  return fetchJson(url);
}

function buildIndicators(ticker, root, price, benchYtd, stockYtd) {
  const indicators = [];
  const hl = root?.Highlights && typeof root.Highlights === "object" ? root.Highlights : null;
  const ar = root?.AnalystRatings && typeof root.AnalystRatings === "object" ? root.AnalystRatings : null;
  const val = root.Valuation && typeof root.Valuation === "object" ? root.Valuation : null;
  const tech = root?.Technicals && typeof root.Technicals === "object" ? root.Technicals : null;
  const gen = root?.General && typeof root.General === "object" ? root.General : null;

  const isEtf =
    String(gen?.Type ?? "").toLowerCase().includes("etf") ||
    String(hl?.Sector ?? gen?.Sector ?? "")
      .toLowerCase()
      .includes("etf");

  if (stockYtd != null && benchYtd != null && !isEtf) {
    const rel = stockYtd - benchYtd;
    const dir = rel >= 0 ? "up" : "down";
    indicators.push({
      id: "vs_sp500_ytd",
      direction: dir,
      text:
        rel >= 0
          ? `Outperforming S&P 500 by ${Math.abs(rel).toFixed(2)}% YTD`
          : `Underperforming S&P 500 by ${Math.abs(rel).toFixed(2)}% YTD`,
      data: { stockYtd, benchYtd, rel },
    });
  }

  const target = firstNum(ar, ["WallStreetTargetPrice", "TargetPrice", "MeanTargetPrice"]) ??
    firstNum(hl, ["WallStreetTargetPrice", "TargetPrice"]);
  if (price != null && target != null && target > 0) {
    const pctVsTarget = ((price - target) / target) * 100;
    // Above target = rich / overpriced (con); below target = discount to consensus (pro).
    const dir = pctVsTarget >= 0 ? "down" : "up";
    indicators.push({
      id: "vs_analyst_target",
      direction: dir,
      text:
        pctVsTarget >= 0
          ? `Trading at ${Math.abs(pctVsTarget).toFixed(2)}% above analyst target`
          : `Trading at ${Math.abs(pctVsTarget).toFixed(2)}% below estimates`,
      data: { price, target, pctVsTarget },
    });
  }

  const epsGrowthAnnual = firstNum(hl, [
    "EPSEstimateGrowth",
    "EarningsGrowth",
    "FiveYearAnnualEPSGrowthRate",
    "EPSGrowth5Y",
    "EPSGrowth3Y",
  ]);
  if (epsGrowthAnnual != null) {
    const asPct = Math.abs(epsGrowthAnnual) <= 2 ? epsGrowthAnnual * 100 : epsGrowthAnnual;
    const dir = asPct >= 0 ? "up" : "down";
    indicators.push({
      id: "eps_growth_forecast",
      direction: dir,
      text: `Earnings are forecast to grow ${Math.abs(asPct).toFixed(2)}% per year`,
      data: { raw: epsGrowthAnnual, asPct },
    });
  }

  const revYoy = firstNum(hl, [
    "QuarterlyRevenueGrowth",
    "RevenueGrowthQuarterlyYoY",
    "QuarterlyRevenueGrowthYOY",
  ]);
  if (revYoy != null) {
    const asPct = Math.abs(revYoy) <= 2 ? revYoy * 100 : revYoy;
    const dir = asPct >= 0 ? "up" : "down";
    indicators.push({
      id: "revenue_yoy",
      direction: dir,
      text: `Revenue grew ${Math.abs(asPct).toFixed(2)}% year-over-year (last quarter)`,
      data: { raw: revYoy, asPct },
    });
  }

  const trailingPe = firstNum(hl, ["PERatio", "PE", "TrailingPE"]) ?? firstNum(val, ["TrailingPE"]);
  const forwardPe = firstNum(hl, ["ForwardPE"]) ?? firstNum(val, ["ForwardPE"]);
  if (trailingPe != null && forwardPe != null && trailingPe > 0) {
    const premium = ((forwardPe - trailingPe) / trailingPe) * 100;
    const dir = premium <= 0 ? "up" : "down";
    indicators.push({
      id: "forward_vs_trailing_pe",
      direction: dir,
      text:
        premium <= 0
          ? `Forward P/E (${forwardPe.toFixed(1)}×) is ${Math.abs(premium).toFixed(0)}% below trailing (${trailingPe.toFixed(1)}×)`
          : `Forward P/E (${forwardPe.toFixed(1)}×) is ${Math.abs(premium).toFixed(0)}% above trailing (${trailingPe.toFixed(1)}×)`,
      data: { trailingPe, forwardPe, premium },
    });
  }

  const beta = firstNum(tech, ["Beta", "Beta5Y"]) ?? firstNum(gen, ["Beta"]) ?? firstNum(hl, ["Beta"]);
  if (beta != null) {
    const dir = beta > 1.1 ? "down" : beta < 0.9 ? "up" : "neutral";
    indicators.push({
      id: "beta",
      direction: dir,
      text:
        beta > 1.1
          ? `More volatile than the market (beta ${beta.toFixed(2)})`
          : beta < 0.9
            ? `Less volatile than the market (beta ${beta.toFixed(2)})`
            : `Market-like volatility (beta ${beta.toFixed(2)})`,
      data: { beta },
    });
  }

  const divYield = firstNum(hl, ["DividendYield", "DividendShare"]);
  if (divYield != null && divYield > 0) {
    const asPct = divYield <= 1 ? divYield * 100 : divYield;
    indicators.push({
      id: "dividend_yield",
      direction: "up",
      text: `Dividend yield ${asPct.toFixed(2)}%`,
      data: { divYield, asPct },
    });
  }

  return { indicators: indicators.slice(0, 6), isEtf, meta: { sector: gen?.Sector ?? hl?.Sector ?? null } };
}

async function main() {
  const key = process.env.EODHD_API_KEY?.trim();
  if (!key) {
    console.error("Missing EODHD_API_KEY in env");
    process.exit(1);
  }

  const year = new Date().getUTCFullYear();
  const from = `${year - 1}-12-15`;
  const to = new Date().toISOString().slice(0, 10);

  console.log("Fetching S&P 500 YTD benchmark…");
  const benchBars = await fetchEodDaily(BENCHMARK, from, to);
  const benchYtd = ytdFromBars(benchBars, year);
  console.log(`Benchmark ${BENCHMARK} YTD: ${fmtPct(benchYtd) ?? "n/a"}\n`);

  const results = [];

  for (const { ticker, note } of SAMPLES) {
    process.stdout.write(`${ticker}… `);
    try {
      const sym = toEodhdSymbol(ticker);
      const [root, bars] = await Promise.all([
        fetchFundamentals(ticker),
        fetchEodDaily(sym, from, to),
      ]);
      const stockYtd = ytdFromBars(bars, year);
      const price = bars.length ? bars[bars.length - 1].close : num(root?.Highlights?.LastClose ?? root?.Technicals?.Price);

      const { indicators, isEtf, meta } = buildIndicators(ticker, root, price, benchYtd, stockYtd);
      results.push({
        ticker,
        note,
        price: fmtUsd(price),
        stockYtd: fmtPct(stockYtd),
        indicatorCount: indicators.length,
        isEtf,
        sector: meta.sector,
        indicators,
        missing:
          indicators.length < 3
            ? "thin — fewer than 3 rule-based indicators"
            : indicators.length < 6
              ? "partial — would show " + indicators.length + " of 6"
              : null,
      });
      console.log(`${indicators.length} indicators`);
    } catch (e) {
      console.log("ERR");
      results.push({ ticker, note, error: e instanceof Error ? e.message : String(e) });
    }
  }

  console.log("\n" + JSON.stringify({ benchmarkYtd: benchYtd, asOf: to, results }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
