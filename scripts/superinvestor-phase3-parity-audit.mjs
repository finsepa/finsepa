#!/usr/bin/env node
/**
 * Superinvestors Phase 3 — data parity & correctness audit.
 *
 * Compares Finsepa market_snapshot vs:
 *   1. Independent SEC EDGAR re-parse (source of truth)
 *   2. Dataroma (benchmark only, where manager exists)
 *
 * Usage:
 *   node --env-file=.env.local scripts/superinvestor-phase3-parity-audit.mjs
 *   node --env-file=.env.local scripts/superinvestor-phase3-parity-audit.mjs --slug=berkshire-hathaway
 */
import { createClient } from "@supabase/supabase-js";
import { performance } from "node:perf_hooks";
import { writeFileSync } from "node:fs";

const UA =
  process.env.SEC_EDGAR_USER_AGENT ||
  "Finsepa Phase3 Parity Audit (hi@finsepa.com)";
const DR_UA =
  "Mozilla/5.0 (compatible; FinsepaParityBot/1.0; +https://app.finsepa.com; hi@finsepa.com)";

/** Slug → padded CIK (mirrors SUPERINVESTOR_SLUG_CIK). */
const MANAGERS = [
  { slug: "berkshire-hathaway", name: "Warren Buffett", cik: "0001067983", dataroma: "BRK" },
  { slug: "bill-ackman", name: "Bill Ackman", cik: "0001336528", dataroma: "psc" },
  { slug: "terry-smith", name: "Terry Smith", cik: "0001569205", dataroma: "FS" },
  { slug: "michael-burry", name: "Michael Burry", cik: "0001649339", dataroma: "SAM" },
  { slug: "cathie-wood", name: "Cathie Wood", cik: "0001697748", dataroma: null },
  { slug: "li-lu", name: "Li Lu", cik: "0001709323", dataroma: "HC" },
  { slug: "ray-dalio", name: "Ray Dalio", cik: "0001350694", dataroma: null },
  { slug: "ken-fisher", name: "Ken Fisher", cik: "0000850529", dataroma: null },
  { slug: "primecap-management", name: "PRIMECAP", cik: "0000763212", dataroma: null },
  { slug: "ken-griffin", name: "Ken Griffin", cik: "0001423053", dataroma: null },
  { slug: "charlie-munger", name: "Charlie Munger", cik: "0000783412", dataroma: null },
  { slug: "blackrock", name: "BlackRock", cik: "0002012383", dataroma: null },
  { slug: "baillie-gifford", name: "Baillie Gifford", cik: "0001088875", dataroma: null },
  { slug: "renaissance-technologies", name: "Jim Simons", cik: "0001037389", dataroma: null },
  { slug: "point72", name: "Steven Cohen", cik: "0001603466", dataroma: null },
  { slug: "first-eagle", name: "First Eagle", cik: "0001325447", dataroma: "FE" },
  { slug: "chris-hohn", name: "Chris Hohn", cik: "0001647251", dataroma: "tci" },
  { slug: "jeremy-grantham", name: "Jeremy Grantham", cik: "0001352662", dataroma: null },
];

const WEIGHT_TOL = 0.05;
const VALUE_TOL_PCT = 0.5; // % vs SEC total
const COUNT_TOL = 0; // exact holdings count vs SEC equity-only aggregate

function argSlug() {
  const a = process.argv.find((x) => x.startsWith("--slug="));
  return a ? a.slice(7) : null;
}

async function sleep(ms) {
  await new Promise((r) => setTimeout(r, ms));
}

async function secFetch(url) {
  const res = await fetch(url, {
    headers: { "User-Agent": UA, Accept: "*/*" },
    cache: "no-store",
    signal: AbortSignal.timeout(45_000),
  });
  return res;
}

function decodeXml(s) {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .trim();
}

function tag(block, name) {
  const re = new RegExp(`<(?:[\\w.-]+:)?${name}[^>]*>([^<]*)</(?:[\\w.-]+:)?${name}>`, "i");
  const m = block.match(re);
  return m ? decodeXml(m[1]) : null;
}

function tagBlock(outer, name) {
  const re = new RegExp(`<(?:[\\w.-]+:)?${name}[^>]*>([\\s\\S]*?)</(?:[\\w.-]+:)?${name}>`, "i");
  const m = outer.match(re);
  return m?.[1] ?? null;
}

function extractShares(block) {
  const inner = tagBlock(block, "shrsOrPrnAmt");
  if (!inner) return null;
  const raw = tag(inner, "sshPrnamt");
  if (raw == null || raw === "") return null;
  const n = Number.parseInt(raw.replace(/,/g, ""), 10);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function extractPutCall(block) {
  const pc = tag(block, "putCall");
  if (!pc) return null;
  const v = pc.trim().toLowerCase();
  if (v === "put" || v === "call") return v;
  return null;
}

function inferUnit(rows) {
  let thousandsVotes = 0;
  let dollarsVotes = 0;
  let maxPxIfThousands = 0;
  for (const r of rows) {
    if (r.shares == null || r.shares < 100 || r.rawValue <= 0) continue;
    const pxT = (r.rawValue * 1000) / r.shares;
    const pxD = r.rawValue / r.shares;
    if (pxT > maxPxIfThousands) maxPxIfThousands = pxT;
    const dollarsPlausible = pxD >= 0.05 && pxD <= 800_000;
    const thousandsPlausible = pxT >= 0.05 && pxT <= 800_000;
    if (dollarsPlausible && pxT > pxD * 200) dollarsVotes++;
    else if (thousandsPlausible) thousandsVotes++;
    else if (dollarsPlausible) dollarsVotes++;
  }
  if (maxPxIfThousands > 2_000_000) return "dollars";
  return dollarsVotes > thousandsVotes ? "dollars" : "thousands";
}

function parseInfoTables(xml, { excludeOptions = true } = {}) {
  const raw = [];
  const re = /<(?:[\w.-]+:)?infoTable[^>]*>([\s\S]*?)<\/(?:[\w.-]+:)?infoTable>/gi;
  let m;
  while ((m = re.exec(xml)) !== null) {
    const block = m[1] ?? "";
    const issuer = tag(block, "nameOfIssuer");
    const title = tag(block, "titleOfClass");
    const valueStr = tag(block, "value");
    const cusip = tag(block, "cusip")?.trim() || null;
    if (!issuer || !valueStr) continue;
    const rawValue = Number.parseInt(valueStr.replace(/,/g, ""), 10);
    if (!Number.isFinite(rawValue) || rawValue < 0) continue;
    const putCall = extractPutCall(block);
    const shares = extractShares(block);
    raw.push({ issuer, title, rawValue, cusip, shares, putCall });
  }
  const unit = inferUnit(raw);
  const parsed = raw.map((r) => ({
    issuer: r.issuer,
    title: r.title,
    cusip: r.cusip,
    shares: r.shares,
    putCall: r.putCall,
    valueThousands:
      unit === "dollars"
        ? Math.round(r.rawValue / 1000)
        : r.rawValue > 500_000_000
          ? Math.round(r.rawValue / 1000)
          : r.rawValue,
  }));

  const filtered = excludeOptions ? parsed.filter((r) => !r.putCall) : parsed;
  const map = new Map();
  for (const r of filtered) {
    const key =
      r.cusip && r.cusip.length >= 6 ? r.cusip.toUpperCase() : `ISS:${r.issuer.toUpperCase()}`;
    const prev = map.get(key);
    if (!prev) {
      map.set(key, {
        issuer: r.issuer,
        title: r.title,
        cusip: r.cusip && r.cusip.length >= 6 ? r.cusip.toUpperCase() : null,
        shares: r.shares,
        valueThousands: r.valueThousands,
      });
    } else {
      prev.valueThousands += r.valueThousands;
      if (r.shares != null) prev.shares = (prev.shares ?? 0) + r.shares;
    }
  }
  const holdings = [...map.values()].sort((a, b) => b.valueThousands - a.valueThousands);
  const totalValueUsd = holdings.reduce((s, h) => s + h.valueThousands * 1000, 0);
  return {
    unit,
    rawRowCount: raw.length,
    optionRowCount: parsed.filter((r) => r.putCall).length,
    holdings,
    totalValueUsd,
    positionCount: holdings.length,
  };
}

async function loadLatest13fHead(cik) {
  const res = await secFetch(`https://data.sec.gov/submissions/CIK${cik}.json`);
  if (!res.ok) return null;
  const j = await res.json();
  const recent = j.filings?.recent ?? j;
  const forms = recent.form ?? [];
  const acc = recent.accessionNumber ?? [];
  const filingDate = recent.filingDate ?? [];
  const reportDate = recent.reportDate ?? [];
  for (let i = 0; i < forms.length; i++) {
    const f = forms[i] ?? "";
    if (f !== "13F-HR" && f !== "13F-HR/A") continue;
    const accession = acc[i]?.trim();
    if (!accession) continue;
    return {
      accession,
      accessionKey: accession.replace(/-/g, "").toLowerCase(),
      filingDate: filingDate[i] ?? null,
      reportDate: reportDate[i] ?? null,
      filerName: typeof j.name === "string" ? j.name : null,
      form: f,
    };
  }
  return null;
}

function archiveCiks(filerCik, accessionDashed) {
  const filer = String(Number.parseInt(filerCik, 10));
  const accNoDash = accessionDashed.replace(/-/g, "");
  const head =
    accNoDash.length >= 10 ? String(Number.parseInt(accNoDash.slice(0, 10), 10)) : filer;
  return head === filer ? [filer] : [filer, head];
}

async function downloadInfotableXml(cik, accessionDashed) {
  for (const cikNum of archiveCiks(cik, accessionDashed)) {
    const acc = accessionDashed.replace(/-/g, "");
    const base = `https://www.sec.gov/Archives/edgar/data/${cikNum}/${acc}`;
    for (const name of ["infotable.xml", "Infotable.xml"]) {
      const r = await secFetch(`${base}/${name}`);
      if (r.ok) return { xml: await r.text(), url: `${base}/${name}`, archiveCik: cikNum };
    }
    const idx = await secFetch(`${base}/index.json`);
    if (!idx.ok) continue;
    try {
      const data = await idx.json();
      const raw = data.directory?.item;
      const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
      for (const it of list) {
        const n = (it.name ?? "").toLowerCase();
        if (n.endsWith(".xml") && n.includes("infotable")) {
          const url = `${base}/${it.name}`;
          const r = await secFetch(url);
          if (r.ok) return { xml: await r.text(), url, archiveCik: cikNum };
        }
      }
      const candidates = list
        .filter((it) => {
          const n = (it.name ?? "").toLowerCase();
          return n.endsWith(".xml") && n !== "primary_doc.xml" && !n.includes("index-headers");
        })
        .sort(
          (a, b) =>
            (Number.parseInt(String(b.size ?? "0"), 10) || 0) -
            (Number.parseInt(String(a.size ?? "0"), 10) || 0),
        );
      for (const it of candidates) {
        const url = `${base}/${it.name}`;
        const r = await secFetch(url);
        if (!r.ok) continue;
        const text = await r.text();
        if (/<(?:[\w.-]+:)?infoTable\b/i.test(text)) {
          return { xml: text, url, archiveCik: cikNum };
        }
      }
    } catch {
      /* ignore */
    }
  }
  return null;
}

function parseMoney(s) {
  if (!s) return null;
  const n = Number(String(s).replace(/[$,]/g, ""));
  return Number.isFinite(n) ? n : null;
}

function parsePct(s) {
  if (s == null || s === "") return null;
  const n = Number(String(s).replace(/%/g, "").trim());
  return Number.isFinite(n) ? n : null;
}

function parseShares(s) {
  if (!s) return null;
  const n = Number(String(s).replace(/,/g, "").trim());
  return Number.isFinite(n) ? n : null;
}

async function fetchDataroma(code) {
  if (!code) return null;
  const url = `https://www.dataroma.com/m/holdings.php?m=${encodeURIComponent(code)}`;
  const res = await fetch(url, {
    headers: { "User-Agent": DR_UA },
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) return { ok: false, status: res.status, url };
  const html = await res.text();
  const meta = html.match(
    /Period:\s*<span>([^<]+)<\/span>.*?Portfolio date:\s*<span>([^<]+)<\/span>.*?No\. of stocks:\s*<span>([^<]+)<\/span>.*?Portfolio value:\s*<span>([^<]+)<\/span>/s,
  );
  const period = meta?.[1]?.trim() ?? null;
  const portfolioDate = meta?.[2]?.trim() ?? null;
  const stockCount = Number.parseInt(String(meta?.[3] ?? "").replace(/,/g, ""), 10) || null;
  const portfolioValue = parseMoney(meta?.[4]);

  const holdings = [];
  const rowRe = /<tr>([\s\S]*?)<\/tr>/gi;
  let rm;
  while ((rm = rowRe.exec(html)) !== null) {
    const row = rm[1];
    if (!row.includes('class="stock"')) continue;
    const symM = row.match(/stock\.php\?sym=([^"]+)/);
    const nameM = row.match(/class="stock"[^>]*>[\s\S]*?<span>\s*-\s*([^<]+)<\/span>/);
    const tds = [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((x) =>
      x[1].replace(/<[^>]+>/g, "").replace(/\u00a0/g, " ").trim(),
    );
    // Columns: History | Stock | % Portfolio | Activity | Shares | Reported$ | Value | … |
    const ticker = symM?.[1]?.toUpperCase() ?? null;
    const company = nameM?.[1]?.trim() ?? null;
    const weight = parsePct(tds[2] ?? "");
    const activity = tds[3] || null;
    const shares = parseShares(tds[4] ?? "");
    const valueUsd = parseMoney(tds[6] ?? "");
    if (ticker) {
      holdings.push({ ticker, company, shares, valueUsd, weight, activity });
    }
  }

  holdings.sort((a, b) => (b.valueUsd ?? 0) - (a.valueUsd ?? 0));
  return {
    ok: true,
    url,
    code,
    period,
    portfolioDate,
    stockCount: stockCount ?? holdings.length,
    portfolioValue,
    holdings,
  };
}

function ymdFromDataromaDate(s) {
  // "31 Mar 2026" → 2026-03-31
  if (!s) return null;
  const m = s.trim().match(/^(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})$/);
  if (!m) return null;
  const months = {
    Jan: "01",
    Feb: "02",
    Mar: "03",
    Apr: "04",
    May: "05",
    Jun: "06",
    Jul: "07",
    Aug: "08",
    Sep: "09",
    Oct: "10",
    Nov: "11",
    Dec: "12",
  };
  const mo = months[m[2]];
  if (!mo) return null;
  return `${m[3]}-${mo}-${String(m[1]).padStart(2, "0")}`;
}

function compareFinsepaToSec(finsepa, sec) {
  const checks = [];
  const fail = (id, detail) => checks.push({ id, pass: false, detail });
  const pass = (id, detail) => checks.push({ id, pass: true, detail });

  if (!finsepa) {
    fail("snapshot_exists", "missing market_snapshot profile");
    return checks;
  }
  if (!sec) {
    fail("sec_parse", "could not parse SEC infotable");
    return checks;
  }

  const cmp = finsepa.comparison;
  const seg = finsepa.segment;
  const head = sec.head;

  if (seg && head?.accessionKey && seg === head.accessionKey) {
    pass("filing_freshness", `segment ${seg} matches SEC latest`);
  } else {
    fail(
      "filing_freshness",
      `snapshot segment=${seg} sec=${head?.accessionKey} form=${head?.form}`,
    );
  }

  if (cmp.current?.filingDate === head?.filingDate) {
    pass("filing_date", cmp.current?.filingDate);
  } else {
    fail("filing_date", `finsepa=${cmp.current?.filingDate} sec=${head?.filingDate}`);
  }

  if (cmp.current?.reportDate === head?.reportDate) {
    pass("report_date", cmp.current?.reportDate);
  } else {
    fail("report_date", `finsepa=${cmp.current?.reportDate} sec=${head?.reportDate}`);
  }

  const finCount = cmp.positionCount ?? cmp.rows?.length ?? 0;
  if (finCount === sec.equity.positionCount) {
    pass("holdings_count", String(finCount));
  } else {
    fail(
      "holdings_count",
      `finsepa=${finCount} sec_equity=${sec.equity.positionCount} sec_with_opts=${sec.withOptions.positionCount} options=${sec.equity.optionRowCount}`,
    );
  }

  const finVal = cmp.totalValueUsd ?? 0;
  const secVal = sec.equity.totalValueUsd;
  const valDeltaPct = secVal > 0 ? (Math.abs(finVal - secVal) / secVal) * 100 : 999;
  if (valDeltaPct <= VALUE_TOL_PCT) {
    pass("portfolio_value", `finsepa=${finVal} sec=${secVal} delta%=${valDeltaPct.toFixed(3)}`);
  } else {
    fail("portfolio_value", `finsepa=${finVal} sec=${secVal} delta%=${valDeltaPct.toFixed(3)}`);
  }

  const weightSum = (cmp.rows ?? []).reduce((s, r) => s + (r.weight || 0), 0);
  if (Math.abs(weightSum - 100) <= WEIGHT_TOL) {
    pass("weights_sum", weightSum.toFixed(4));
  } else {
    fail("weights_sum", weightSum.toFixed(4));
  }

  // Top 10 by value: match CUSIP or issuer
  const finTop = (cmp.rows ?? []).slice(0, 10);
  const secTop = sec.equity.holdings.slice(0, 10);
  let topMatches = 0;
  for (let i = 0; i < Math.min(finTop.length, secTop.length); i++) {
    const f = finTop[i];
    const s = secTop[i];
    const cusipOk =
      f.cusip && s.cusip && f.cusip.toUpperCase() === s.cusip.toUpperCase();
    const nameOk =
      f.companyName?.trim().toUpperCase() === s.issuer?.trim().toUpperCase();
    if (cusipOk || nameOk) topMatches++;
  }
  if (topMatches >= Math.min(8, finTop.length, secTop.length)) {
    pass("top_holdings_order", `${topMatches}/${Math.min(finTop.length, secTop.length)} aligned`);
  } else {
    fail(
      "top_holdings_order",
      `${topMatches} aligned; finsepa=[${finTop
        .slice(0, 5)
        .map((r) => r.ticker || r.companyName)
        .join(", ")}] sec=[${secTop
        .slice(0, 5)
        .map((r) => r.issuer)
        .join(", ")}]`,
    );
  }

  // Share/value spot check on overlapping CUSIPs (top 20)
  const secByCusip = new Map(
    sec.equity.holdings.filter((h) => h.cusip).map((h) => [h.cusip, h]),
  );
  let shareMismatches = 0;
  let valueMismatches = 0;
  let compared = 0;
  for (const row of (cmp.rows ?? []).slice(0, 50)) {
    if (!row.cusip) continue;
    const s = secByCusip.get(row.cusip.toUpperCase());
    if (!s) continue;
    compared++;
    if (row.shares != null && s.shares != null && row.shares !== s.shares) shareMismatches++;
    const finV = row.valueUsd;
    const secV = s.valueThousands * 1000;
    if (secV > 0 && Math.abs(finV - secV) / secV > 0.01) valueMismatches++;
  }
  if (compared === 0) {
    fail("shares_values_spot", "no overlapping CUSIPs in top 50");
  } else if (shareMismatches === 0 && valueMismatches === 0) {
    pass("shares_values_spot", `${compared} CUSIPs matched`);
  } else {
    fail(
      "shares_values_spot",
      `compared=${compared} share_mismatches=${shareMismatches} value_mismatches=${valueMismatches}`,
    );
  }

  // Duplicate CUSIPs
  const seen = new Map();
  for (const row of cmp.rows ?? []) {
    const k = row.cusip?.length >= 6 ? `C:${row.cusip}` : `I:${row.companyName}`;
    seen.set(k, (seen.get(k) ?? 0) + 1);
  }
  const dups = [...seen.entries()].filter(([, n]) => n > 1);
  if (dups.length === 0) pass("duplicate_rows", "none");
  else fail("duplicate_rows", dups.slice(0, 5).map(([k]) => k).join(", "));

  const unresolved = (cmp.rows ?? []).filter((r) => !r.ticker?.trim()).length;
  const rate =
    finCount > 0 ? ((finCount - unresolved) / finCount) * 100 : 100;
  if (rate >= 90 || finCount < 20) {
    pass("ticker_resolution", `${rate.toFixed(1)}% (${unresolved} unresolved)`);
  } else {
    fail("ticker_resolution", `${rate.toFixed(1)}% (${unresolved} unresolved)`);
  }

  // Activity status counts
  const statuses = { new: 0, increased: 0, reduced: 0, unchanged: 0, soldOut: (cmp.soldOut ?? []).length };
  for (const row of cmp.rows ?? []) {
    const st = row.status ?? "unchanged";
    if (st in statuses) statuses[st]++;
    else if (st === "sold") statuses.soldOut++;
  }
  pass(
    "activity_counts",
    `new=${statuses.new} inc=${statuses.increased} red=${statuses.reduced} sold=${statuses.soldOut}`,
  );

  return checks;
}

function compareDataroma(finsepa, dataroma, sec) {
  const notes = [];
  if (!dataroma?.ok) {
    notes.push({ level: "info", msg: "Dataroma not available for this manager" });
    return notes;
  }
  const cmp = finsepa?.comparison;
  if (!cmp) return notes;

  const drDate = ymdFromDataromaDate(dataroma.portfolioDate);
  if (drDate && cmp.current?.reportDate && drDate === cmp.current.reportDate) {
    notes.push({ level: "ok", msg: `Dataroma period matches reportDate ${drDate}` });
  } else {
    notes.push({
      level: "diff",
      msg: `Dataroma date=${dataroma.portfolioDate} (${drDate}) vs Finsepa reportDate=${cmp.current?.reportDate}`,
      cause: "period_mismatch_or_stale",
    });
  }

  const finCount = cmp.positionCount ?? 0;
  if (dataroma.stockCount === finCount) {
    notes.push({ level: "ok", msg: `Holdings count matches Dataroma (${finCount})` });
  } else {
    notes.push({
      level: "diff",
      msg: `Holdings count Finsepa=${finCount} Dataroma=${dataroma.stockCount} SEC=${sec?.equity?.positionCount}`,
      cause:
        Math.abs((sec?.equity?.positionCount ?? 0) - finCount) <= COUNT_TOL
          ? "dataroma_filters_or_aggregates_differently"
          : "investigate_finsepa_vs_sec",
    });
  }

  const finVal = cmp.totalValueUsd ?? 0;
  const drVal = dataroma.portfolioValue ?? 0;
  if (drVal > 0) {
    const d = (Math.abs(finVal - drVal) / drVal) * 100;
    if (d <= 1) {
      notes.push({ level: "ok", msg: `Portfolio value within 1% of Dataroma (delta ${d.toFixed(3)}%)` });
    } else {
      const secD =
        sec?.equity?.totalValueUsd > 0
          ? (Math.abs(finVal - sec.equity.totalValueUsd) / sec.equity.totalValueUsd) * 100
          : null;
      notes.push({
        level: "diff",
        msg: `Value Finsepa=${finVal} Dataroma=${drVal} delta%=${d.toFixed(2)} SEC_delta%=${secD?.toFixed(3) ?? "n/a"}`,
        cause:
          secD != null && secD <= VALUE_TOL_PCT
            ? "dataroma_inconsistency_or_filter"
            : "finsepa_vs_sec_value",
      });
    }
  }

  // Top tickers overlap
  const finTickers = new Set(
    (cmp.rows ?? [])
      .slice(0, 15)
      .map((r) => r.ticker?.toUpperCase())
      .filter(Boolean),
  );
  const drTickers = dataroma.holdings.slice(0, 15).map((h) => h.ticker);
  const overlap = drTickers.filter((t) => finTickers.has(t)).length;
  notes.push({
    level: overlap >= Math.min(8, drTickers.length) ? "ok" : "diff",
    msg: `Top-15 ticker overlap vs Dataroma: ${overlap}/${drTickers.length}`,
    cause: overlap < 8 ? "ticker_resolution_or_aggregation" : undefined,
  });

  return notes;
}

async function loadFinsepaSnapshot(supabase, cik) {
  const key = `superinvestor_13f_profile_v3_${cik}`;
  const { data, error } = await supabase
    .from("market_snapshot")
    .select("key, segment, updated_at, data")
    .eq("key", key)
    .maybeSingle();
  if (error || !data) return null;
  return {
    key,
    segment: data.segment,
    updatedAt: data.updated_at,
    comparison: data.data?.comparison ?? null,
    transactions: data.data?.transactions ?? null,
  };
}

function verdictFromChecks(checks, dataromaNotes) {
  const fails = checks.filter((c) => !c.pass && c.id !== "activity_counts");
  const critical = fails.filter((c) =>
    [
      "snapshot_exists",
      "sec_parse",
      "filing_freshness",
      "holdings_count",
      "portfolio_value",
      "weights_sum",
      "duplicate_rows",
      "shares_values_spot",
    ].includes(c.id),
  );
  if (critical.length) return "FAIL";
  const soft = fails.filter((c) => !critical.includes(c));
  if (soft.length) return "WATCH";
  const drBad = (dataromaNotes ?? []).filter(
    (n) => n.level === "diff" && n.cause === "finsepa_vs_sec_value",
  );
  if (drBad.length) return "FAIL";
  return "PASS";
}

async function auditManager(supabase, manager) {
  const t0 = performance.now();
  const finsepa = await loadFinsepaSnapshot(supabase, manager.cik);
  await sleep(120);
  const head = await loadLatest13fHead(manager.cik);
  await sleep(120);
  let xmlPack = null;
  let equity = null;
  let withOptions = null;
  if (head) {
    xmlPack = await downloadInfotableXml(manager.cik, head.accession);
    if (xmlPack?.xml) {
      equity = parseInfoTables(xmlPack.xml, { excludeOptions: true });
      withOptions = parseInfoTables(xmlPack.xml, { excludeOptions: false });
    }
  }
  await sleep(200);
  const dataroma = manager.dataroma ? await fetchDataroma(manager.dataroma) : null;

  const sec = head
    ? {
        head,
        xmlUrl: xmlPack?.url ?? null,
        equity,
        withOptions,
      }
    : null;

  const checks = compareFinsepaToSec(finsepa, sec);
  const dataromaNotes = compareDataroma(finsepa, dataroma, sec);
  const verdict = verdictFromChecks(checks, dataromaNotes);

  return {
    slug: manager.slug,
    name: manager.name,
    cik: manager.cik,
    elapsedMs: Math.round(performance.now() - t0),
    verdict,
    finsepa: finsepa
      ? {
          segment: finsepa.segment,
          updatedAt: finsepa.updatedAt,
          filingDate: finsepa.comparison?.current?.filingDate,
          reportDate: finsepa.comparison?.current?.reportDate,
          accession: finsepa.comparison?.current?.accessionNumber,
          positionCount: finsepa.comparison?.positionCount,
          totalValueUsd: finsepa.comparison?.totalValueUsd,
          source: finsepa.comparison?.source,
          unresolvedTickers: (finsepa.comparison?.rows ?? []).filter((r) => !r.ticker?.trim())
            .length,
          top5: (finsepa.comparison?.rows ?? []).slice(0, 5).map((r) => ({
            ticker: r.ticker,
            name: r.companyName,
            weight: r.weight,
            valueUsd: r.valueUsd,
            shares: r.shares,
            status: r.status,
          })),
        }
      : null,
    sec: sec
      ? {
          accession: sec.head.accession,
          form: sec.head.form,
          filingDate: sec.head.filingDate,
          reportDate: sec.head.reportDate,
          xmlUrl: sec.xmlUrl,
          equityCount: sec.equity?.positionCount,
          equityValue: sec.equity?.totalValueUsd,
          withOptionsCount: sec.withOptions?.positionCount,
          optionRows: sec.equity?.optionRowCount,
          unit: sec.equity?.unit,
          top5: (sec.equity?.holdings ?? []).slice(0, 5).map((h) => ({
            name: h.issuer,
            cusip: h.cusip,
            valueUsd: h.valueThousands * 1000,
            shares: h.shares,
          })),
        }
      : null,
    dataroma: dataroma?.ok
      ? {
          code: manager.dataroma,
          period: dataroma.period,
          portfolioDate: dataroma.portfolioDate,
          stockCount: dataroma.stockCount,
          portfolioValue: dataroma.portfolioValue,
          top5: dataroma.holdings.slice(0, 5).map((h) => ({
            ticker: h.ticker,
            weight: h.weight,
            valueUsd: h.valueUsd,
            shares: h.shares,
            activity: h.activity,
          })),
        }
      : manager.dataroma
        ? { code: manager.dataroma, error: "fetch_failed" }
        : { code: null, note: "not_tracked_on_dataroma" },
    checks,
    dataromaNotes,
  };
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Missing Supabase env");
    process.exit(1);
  }
  const supabase = createClient(url, key);
  const only = argSlug();
  const list = only ? MANAGERS.filter((m) => m.slug === only) : MANAGERS;
  if (!list.length) {
    console.error("No managers matched");
    process.exit(1);
  }

  console.log(`Phase 3 parity audit — ${list.length} managers\n`);
  const results = [];
  for (const m of list) {
    process.stdout.write(`Auditing ${m.name} (${m.slug})... `);
    try {
      const r = await auditManager(supabase, m);
      results.push(r);
      console.log(r.verdict);
    } catch (e) {
      console.log("ERROR", e.message);
      results.push({
        slug: m.slug,
        name: m.name,
        cik: m.cik,
        verdict: "FAIL",
        error: String(e?.message ?? e),
        checks: [{ id: "exception", pass: false, detail: String(e) }],
        dataromaNotes: [],
      });
    }
  }

  const summary = {
    at: new Date().toISOString(),
    pass: results.filter((r) => r.verdict === "PASS").length,
    watch: results.filter((r) => r.verdict === "WATCH").length,
    fail: results.filter((r) => r.verdict === "FAIL").length,
    results,
  };

  const outPath = "docs/SUPERINVESTORS-PHASE-3-PARITY-AUDIT.json";
  writeFileSync(outPath, JSON.stringify(summary, null, 2));
  console.log(`\nWrote ${outPath}`);

  console.log("\n=== SUMMARY ===");
  for (const r of results) {
    const fails = (r.checks ?? []).filter((c) => !c.pass).map((c) => c.id);
    console.log(
      `${r.verdict.padEnd(5)} ${r.name.padEnd(18)} count F=${r.finsepa?.positionCount ?? "?"} S=${r.sec?.equityCount ?? "?"} D=${r.dataroma?.stockCount ?? "-"} | fails=[${fails.join(",")}]`,
    );
  }
  console.log(
    `\nPASS=${summary.pass} WATCH=${summary.watch} FAIL=${summary.fail}`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
