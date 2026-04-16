/**
 * Regenerates `lib/superinvestors/fixtures/berkshire-holdings-fallback.json` from a Berkshire 13F XML.
 * Parsing mirrors `lib/superinvestors/berkshire-13f.ts` (value unit inference + CUSIP aggregation).
 *
 * Usage:
 *   node scripts/refresh-berkshire-13f-fixture.mjs [url-to-xml]
 *
 * Default URL: latest known Q4 2025 13F-HR infotable path on www.sec.gov.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, "../lib/superinvestors/fixtures/berkshire-holdings-fallback.json");

const DEFAULT_XML_URL =
  "https://www.sec.gov/Archives/edgar/data/1067983/000119312526054580/50240.xml";

const UA = process.env.SEC_EDGAR_USER_AGENT?.trim() || "Finsepa/1.0 (https://finsepa.com)";

function decodeXmlText(s) {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .trim();
}

function extractTagContent(block, localName) {
  const q = localName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const cdata = new RegExp(
    `<(?:[\\w.-]+:)?${q}[^>]*>\\s*<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>\\s*</(?:[\\w.-]+:)?${q}>`,
    "i",
  );
  const cd = block.match(cdata);
  if (cd?.[1] != null) return decodeXmlText(cd[1]);
  const plain = new RegExp(`<(?:[\\w.-]+:)?${q}[^>]*>([^<]*)</(?:[\\w.-]+:)?${q}>`, "i");
  const pl = block.match(plain);
  if (pl?.[1] != null) return decodeXmlText(pl[1]);
  return null;
}

function extractTagBlock(outer, localName) {
  const q = localName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`<(?:[\\w.-]+:)?${q}[^>]*>([\\s\\S]*?)</(?:[\\w.-]+:)?${q}>`, "i");
  const m = outer.match(re);
  return m?.[1] ?? null;
}

function extractSharesFromInfoTableBlock(block) {
  const inner = extractTagBlock(block, "shrsOrPrnAmt");
  if (!inner) return null;
  const raw = extractTagContent(inner, "sshPrnamt");
  if (raw == null || raw === "") return null;
  const n = Number.parseInt(raw.replace(/,/g, ""), 10);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

const SEC_13F_VALUE_MAX_CREDIBLE_THOUSANDS = 500_000_000;

function normalizeSec13fValueThousands(raw) {
  if (!Number.isFinite(raw) || raw < 0) return raw;
  if (raw > SEC_13F_VALUE_MAX_CREDIBLE_THOUSANDS) {
    return Math.round(raw / 1000);
  }
  return raw;
}

function inferSec13fValueFieldUnit(rows) {
  let thousandsVotes = 0;
  let dollarsVotes = 0;
  let maxPxIfThousands = 0;
  for (const r of rows) {
    const { rawValue, shares } = r;
    if (shares == null || shares < 100 || !Number.isFinite(rawValue) || rawValue <= 0) continue;
    const pxIfThousands = (rawValue * 1000) / shares;
    const pxIfDollars = rawValue / shares;
    if (pxIfThousands > maxPxIfThousands) maxPxIfThousands = pxIfThousands;
    const dollarsPlausible = pxIfDollars >= 0.05 && pxIfDollars <= 800_000;
    const thousandsPlausible = pxIfThousands >= 0.05 && pxIfThousands <= 800_000;
    if (dollarsPlausible && pxIfThousands > pxIfDollars * 200) {
      dollarsVotes++;
    } else if (thousandsPlausible && pxIfDollars < 0.5) {
      thousandsVotes++;
    } else if (thousandsPlausible) {
      thousandsVotes++;
    } else if (dollarsPlausible) {
      dollarsVotes++;
    }
  }
  if (maxPxIfThousands > 2_000_000) return "dollars";
  return dollarsVotes > thousandsVotes ? "dollars" : "thousands";
}

function rawInfoRowsFromXml(xml) {
  const out = [];
  const re = /<(?:[\w.-]+:)?infoTable[^>]*>([\s\S]*?)<\/(?:[\w.-]+:)?infoTable>/gi;
  let m;
  while ((m = re.exec(xml)) !== null) {
    const block = m[1] ?? "";
    const issuer = extractTagContent(block, "nameOfIssuer");
    const title = extractTagContent(block, "titleOfClass");
    const valueStr = extractTagContent(block, "value");
    const cusipRaw = extractTagContent(block, "cusip");
    if (!issuer || !valueStr) continue;
    const rawValue = Number.parseInt(valueStr.replace(/,/g, ""), 10);
    if (!Number.isFinite(rawValue) || rawValue < 0) continue;
    const cusip = cusipRaw?.trim() || null;
    const shares = extractSharesFromInfoTableBlock(block);
    out.push({ issuer, title: title || null, rawValue, cusip, shares });
  }
  return out;
}

function parseInfoTableRows(xml) {
  const rawRows = rawInfoRowsFromXml(xml);
  const unit = inferSec13fValueFieldUnit(rawRows);
  return rawRows.map((r) => {
    const valueThousands =
      unit === "dollars" ? Math.round(r.rawValue / 1000) : normalizeSec13fValueThousands(r.rawValue);
    return {
      issuer: r.issuer,
      title: r.title,
      valueThousands,
      cusip: r.cusip,
      shares: r.shares,
    };
  });
}

function aggregateKeyFromParsed(r) {
  return r.cusip && r.cusip.length >= 6 ? r.cusip.toUpperCase() : `ISS:${r.issuer.toUpperCase()}`;
}

function aggregateInfoRowsByCusip(rows) {
  const map = new Map();
  for (const r of rows) {
    const key = aggregateKeyFromParsed(r);
    const prev = map.get(key);
    const cusipNorm = r.cusip && r.cusip.length >= 6 ? r.cusip.toUpperCase() : null;
    if (!prev) {
      map.set(key, {
        issuer: r.issuer,
        title: r.title,
        valueThousands: r.valueThousands,
        cusip: cusipNorm,
        shares: r.shares,
      });
    } else {
      prev.valueThousands += r.valueThousands;
      if (r.shares != null) {
        prev.shares = (prev.shares ?? 0) + r.shares;
      }
    }
  }
  return [...map.values()];
}

async function main() {
  const url = process.argv[2] || DEFAULT_XML_URL;
  const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/xml,text/xml,*/*" } });
  if (!res.ok) throw new Error(`fetch ${url}: ${res.status}`);
  const xml = await res.text();
  const parsed = parseInfoTableRows(xml);
  const merged = aggregateInfoRowsByCusip(parsed);
  const holdings = merged
    .map((r) => ({
      issuer: r.issuer,
      titleOfClass: r.title,
      valueUsd: r.valueThousands * 1000,
    }))
    .sort((a, b) => b.valueUsd - a.valueUsd);

  const out = {
    filerDisplayName: "Berkshire Hathaway Inc.",
    cik: "0001067983",
    holdings,
  };

  fs.writeFileSync(OUT, `${JSON.stringify(out, null, 2)}\n`);
  const totalBn = holdings.reduce((s, h) => s + h.valueUsd, 0) / 1e9;
  console.error(`Wrote ${holdings.length} rows, ~$${totalBn.toFixed(2)}B → ${OUT}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
