/**
 * Mirror locked IR vault PDFs into Supabase Storage (Quartr-style).
 *
 * Decision is automatic per URL:
 *   1) Plain HTTP fetch (MU path) — used when origin returns a real PDF
 *   2) Playwright download (TSM path) — only if plain fetch fails (403 / CF / HTML)
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/earnings-ir-docs-mirror.ts --tickers=AMZN,ASML
 *   npx tsx --env-file=.env.local scripts/earnings-ir-docs-mirror.ts --greens
 *   npx tsx --env-file=.env.local scripts/earnings-ir-docs-mirror.ts --greens --limit=1 --dry-run
 */

import { createClient } from "@supabase/supabase-js";
import { chromium, type Browser, type Page } from "playwright";

import {
  EARNINGS_IR_DOCS_BUCKET,
  earningsIrDocObjectPath,
  earningsIrDocPublicUrl,
  isEarningsIrDocsHostedUrl,
  type EarningsIrDocKind,
} from "../lib/market/earnings-ir-docs-storage";

type VaultRow = {
  ticker: string;
  fiscal_period_end: string;
  slides_url: string | null;
  filings_url: string | null;
  slides_locked: boolean;
  filings_locked: boolean;
};

function argValue(flag: string): string | null {
  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith(`${flag}=`)) return arg.slice(flag.length + 1).trim() || null;
  }
  const i = process.argv.indexOf(flag);
  if (i < 0) return null;
  return process.argv[i + 1]?.trim() || null;
}

function hasFlag(flag: string): boolean {
  return process.argv.includes(flag);
}

function parseLimit(): number {
  return Math.max(0, Number(argValue("--limit") ?? "0") || 0);
}

function isPdfBuffer(buf: Buffer): boolean {
  return buf.length >= 5 && buf.subarray(0, 5).toString("utf8") === "%PDF-";
}

async function fetchPdfPlain(url: string): Promise<Buffer> {
  const res = await fetch(url, {
    method: "GET",
    headers: {
      Accept: "application/pdf,*/*",
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
    },
    redirect: "follow",
  });
  if (!res.ok) throw new Error(`http ${res.status}`);
  const ct = (res.headers.get("content-type") ?? "").toLowerCase();
  const buf = Buffer.from(await res.arrayBuffer());
  if (!isPdfBuffer(buf)) throw new Error(`not a PDF (ct=${ct}, bytes=${buf.length})`);
  if (ct.includes("text/html")) throw new Error("HTML instead of PDF");
  return buf;
}

async function waitForCfClearance(page: Page): Promise<void> {
  for (let i = 0; i < 40; i++) {
    const title = await page.title().catch(() => "");
    if (!/just a moment/i.test(title)) return;
    await page.waitForTimeout(500);
  }
}

async function fetchPdfBrowser(page: Page, src: string): Promise<Buffer> {
  const downloadPromise = page.waitForEvent("download", { timeout: 90_000 });
  await page.goto(src, { waitUntil: "commit", timeout: 90_000 }).catch((e: unknown) => {
    const msg = e instanceof Error ? e.message : String(e);
    if (!/Download is starting/i.test(msg)) throw e;
  });
  const download = await downloadPromise;
  const stream = await download.createReadStream();
  if (!stream) {
    const failure = await download.failure();
    if (failure) throw new Error(`download failed: ${failure}`);
    const path = await download.path();
    if (!path) throw new Error("download has no path/stream");
    const { readFile } = await import("node:fs/promises");
    const body = await readFile(path);
    if (!isPdfBuffer(body)) throw new Error(`not a PDF (${body.length} bytes)`);
    return body;
  }
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const body = Buffer.concat(chunks);
  if (!isPdfBuffer(body)) {
    throw new Error(`not a PDF (${body.length} bytes, suggested=${download.suggestedFilename()})`);
  }
  return body;
}

type FetchMode = "plain" | "browser";

async function fetchPdfAuto(
  src: string,
  opts: {
    ensureBrowser: () => Promise<Page>;
    warmHostIfNeeded: (src: string) => Promise<void>;
  },
): Promise<{ body: Buffer; mode: FetchMode }> {
  try {
    const body = await fetchPdfPlain(src);
    return { body, mode: "plain" };
  } catch (plainErr) {
    await opts.warmHostIfNeeded(src);
    const page = await opts.ensureBrowser();
    try {
      const body = await fetchPdfBrowser(page, src);
      return { body, mode: "browser" };
    } catch (browserErr) {
      const p = plainErr instanceof Error ? plainErr.message : String(plainErr);
      const b = browserErr instanceof Error ? browserErr.message : String(browserErr);
      throw new Error(`plain=${p}; browser=${b}`);
    }
  }
}

async function main() {
  const greens = hasFlag("--greens");
  const tickersRaw = argValue("--tickers");
  const limit = parseLimit();
  const dryRun = hasFlag("--dry-run");
  const includeHosted = hasFlag("--include-hosted"); // usually skip; hosted URLs can't re-source issuer

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) {
    throw new Error("Need NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY");
  }

  const admin = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let tickers: string[] | null = null;
  if (tickersRaw) {
    tickers = tickersRaw
      .split(",")
      .map((t) => t.trim().toUpperCase())
      .filter(Boolean);
  }

  let query = admin
    .from("earnings_ir_vault")
    .select("ticker,fiscal_period_end,slides_url,filings_url,slides_locked,filings_locked")
    .order("fiscal_period_end", { ascending: false });

  if (tickers?.length) query = query.in("ticker", tickers);

  const { data: rows, error } = await query;
  if (error) throw new Error(error.message);

  let work = (rows ?? []) as VaultRow[];

  if (greens) {
    // Dual-locked quarters only (traffic-light green rows).
    work = work.filter((r) => r.slides_locked && r.filings_locked);
  }

  if (tickers?.length) {
    // already filtered by query
  } else if (!greens) {
    throw new Error("Pass --tickers=MU,AMZN or --greens");
  }

  if (limit > 0) {
    const endsByTicker = new Map<string, string[]>();
    const next: VaultRow[] = [];
    for (const r of work) {
      const ends = endsByTicker.get(r.ticker) ?? [];
      if (!ends.includes(r.fiscal_period_end)) {
        if (ends.length >= limit) continue;
        ends.push(r.fiscal_period_end);
        endsByTicker.set(r.ticker, ends);
      }
      if (ends.includes(r.fiscal_period_end)) next.push(r);
    }
    work = next;
  }

  const tickerList = [...new Set(work.map((r) => r.ticker))].sort();
  console.log(
    `Mirror auto: ${work.length} row(s) across ${tickerList.join(",")}${dryRun ? " (dry-run)" : ""}`,
  );

  let browser: Browser | null = null;
  let page: Page | null = null;
  const warmedHosts = new Set<string>();

  async function ensureBrowser(): Promise<Page> {
    if (page) return page;
    console.log("  escalating: launching Playwright (plain fetch failed)");
    browser = await chromium.launch({
      headless: true,
      args: ["--disable-blink-features=AutomationControlled"],
    });
    const context = await browser.newContext({
      acceptDownloads: true,
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
      locale: "en-US",
    });
    await context.addInitScript(() => {
      Object.defineProperty(navigator, "webdriver", { get: () => undefined });
    });
    page = await context.newPage();
    return page;
  }

  async function warmHostIfNeeded(src: string): Promise<void> {
    try {
      const host = new URL(src).origin;
      if (warmedHosts.has(host)) return;
      const p = await ensureBrowser();
      await p.goto(host, { waitUntil: "domcontentloaded", timeout: 60_000 }).catch(() => undefined);
      await waitForCfClearance(p);
      await p.waitForTimeout(1500);
      warmedHosts.add(host);
      console.log(`  warmed ${host}`);
    } catch {
      /* best-effort */
    }
  }

  let ok = 0;
  let skip = 0;
  let fail = 0;
  let plainOk = 0;
  let browserOk = 0;

  for (const row of work) {
    const updates: {
      slides_url?: string;
      filings_url?: string;
      resolution_note?: string;
      verified_at?: string;
      updated_at?: string;
    } = {};
    const kinds: { kind: EarningsIrDocKind; url: string | null; locked: boolean }[] = [
      { kind: "slides", url: row.slides_url, locked: row.slides_locked },
      { kind: "filings", url: row.filings_url, locked: row.filings_locked },
    ];

    for (const { kind, url: src, locked } of kinds) {
      if (!locked || !src?.startsWith("https://")) {
        skip += 1;
        continue;
      }
      if (isEarningsIrDocsHostedUrl(src)) {
        if (!includeHosted) {
          console.log(`  skip already hosted ${row.ticker} ${row.fiscal_period_end} ${kind}`);
          skip += 1;
          continue;
        }
      }

      const objectPath = earningsIrDocObjectPath(row.ticker, row.fiscal_period_end, kind);
      const publicUrl = earningsIrDocPublicUrl(url, objectPath);

      try {
        console.log(`  fetch ${row.ticker} ${row.fiscal_period_end} ${kind}`);
        const result = await fetchPdfAuto(src, { ensureBrowser, warmHostIfNeeded });

        if (result.mode === "plain") plainOk += 1;
        else browserOk += 1;

        if (dryRun) {
          console.log(
            `  dry-run ${result.mode} would upload ${objectPath} (${result.body.length} bytes)`,
          );
          ok += 1;
          continue;
        }

        const { error: upErr } = await admin.storage.from(EARNINGS_IR_DOCS_BUCKET).upload(
          objectPath,
          result.body,
          {
            contentType: "application/pdf",
            upsert: true,
            cacheControl: "public, max-age=86400",
          },
        );
        if (upErr) throw new Error(upErr.message);

        if (kind === "slides") updates.slides_url = publicUrl;
        else updates.filings_url = publicUrl;
        console.log(`  ok [${result.mode}] ${objectPath} (${result.body.length} bytes)`);
        ok += 1;
      } catch (e) {
        fail += 1;
        console.error(`  FAIL ${row.ticker} ${row.fiscal_period_end} ${kind}:`, e);
      }
    }

    if (!dryRun && (updates.slides_url || updates.filings_url)) {
      updates.resolution_note = "Mirrored IR PDF to earnings-ir-docs (auto plain→browser)";
      updates.verified_at = new Date().toISOString();
      updates.updated_at = new Date().toISOString();
      const { error: updErr } = await admin
        .from("earnings_ir_vault")
        .update(updates)
        .eq("ticker", row.ticker)
        .eq("fiscal_period_end", row.fiscal_period_end);
      if (updErr) {
        console.error(`  vault update failed ${row.ticker} ${row.fiscal_period_end}:`, updErr.message);
        fail += 1;
      }
    }
  }

  if (browser) await browser.close();

  console.log(JSON.stringify({ ok, skip, fail, plainOk, browserOk }, null, 2));
  if (fail > 0) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
