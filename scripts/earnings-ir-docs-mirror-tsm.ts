/**
 * Mirror TSMC IR PDFs through Chromium (Cloudflare blocks plain/API fetches).
 * After warming investor.tsmc.com, each PDF is captured via the download event.
 *
 *   npx tsx --env-file=.env.local scripts/earnings-ir-docs-mirror-tsm.ts
 *   npx tsx --env-file=.env.local scripts/earnings-ir-docs-mirror-tsm.ts --limit=1
 */

import { createClient } from "@supabase/supabase-js";
import { chromium, type Page } from "playwright";

import {
  EARNINGS_IR_DOCS_BUCKET,
  earningsIrDocObjectPath,
  earningsIrDocPublicUrl,
  type EarningsIrDocKind,
} from "../lib/market/earnings-ir-docs-storage.ts";
import {
  TSMC_IR_QUARTER_DOCS,
  tsmcFilingsUrlFromPackage,
  type TsmcQuarterDocs,
} from "../lib/market/ir-seed-tsmc-catalog.ts";

function fiscalEnd(docs: TsmcQuarterDocs): string {
  const ends: Record<number, string> = {
    1: `${docs.fy}-03-31`,
    2: `${docs.fy}-06-30`,
    3: `${docs.fy}-09-30`,
    4: `${docs.fy}-12-31`,
  };
  return ends[docs.fq]!;
}

/** Supports `--limit 1` and `--limit=1`. */
function parseLimit(): number {
  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith("--limit=")) {
      return Math.max(0, Number(arg.slice("--limit=".length)) || 0);
    }
  }
  const i = process.argv.indexOf("--limit");
  if (i >= 0) return Math.max(0, Number(process.argv[i + 1]) || 0);
  return 0;
}

async function waitForCfClearance(page: Page): Promise<void> {
  for (let i = 0; i < 40; i++) {
    const title = await page.title().catch(() => "");
    if (!/just a moment/i.test(title)) return;
    await page.waitForTimeout(500);
  }
}

async function downloadPdfViaPage(page: Page, src: string): Promise<Buffer> {
  const downloadPromise = page.waitForEvent("download", { timeout: 90_000 });
  // PDF URLs trigger a download instead of document navigation.
  await page.goto(src, { waitUntil: "commit", timeout: 90_000 }).catch((e: unknown) => {
    const msg = e instanceof Error ? e.message : String(e);
    if (!/Download is starting/i.test(msg)) throw e;
  });
  const download = await downloadPromise;
  const stream = await download.createReadStream();
  if (!stream) {
    // Fallback path when stream is unavailable.
    const failure = await download.failure();
    if (failure) throw new Error(`download failed: ${failure}`);
    const path = await download.path();
    if (!path) throw new Error("download has no path/stream");
    const { readFile } = await import("node:fs/promises");
    const body = await readFile(path);
    if (body.length < 5 || body.subarray(0, 5).toString("utf8") !== "%PDF-") {
      throw new Error(`not a PDF (${body.length} bytes)`);
    }
    return body;
  }

  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const body = Buffer.concat(chunks);
  if (body.length < 5 || body.subarray(0, 5).toString("utf8") !== "%PDF-") {
    throw new Error(`not a PDF (${body.length} bytes, suggested=${download.suggestedFilename()})`);
  }
  return body;
}

async function main() {
  const limit = parseLimit();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) throw new Error("Need NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY");

  const admin = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let quarters = [...TSMC_IR_QUARTER_DOCS];
  if (limit > 0) quarters = quarters.slice(0, limit);

  console.log(`TSM mirror: ${quarters.length} quarter(s) via Playwright download`);

  const browser = await chromium.launch({
    headless: true,
    args: ["--disable-blink-features=AutomationControlled"],
  });
  const context = await browser.newContext({
    acceptDownloads: true,
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
    locale: "en-US",
    extraHTTPHeaders: {
      "Accept-Language": "en-US,en;q=0.9",
    },
  });
  await context.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => undefined });
  });
  const page = await context.newPage();

  try {
    await page.goto("https://investor.tsmc.com/english/quarterly-results", {
      waitUntil: "domcontentloaded",
      timeout: 90_000,
    });
    await waitForCfClearance(page);
    await page.waitForTimeout(3000);
    console.log(`warm title=${await page.title()}`);
  } catch (e) {
    console.warn("IR landing warm failed (continuing):", e);
  }

  let ok = 0;
  let fail = 0;

  for (const docs of quarters) {
    const end = fiscalEnd(docs);
    const jobs: { kind: EarningsIrDocKind; src: string | null }[] = [
      { kind: "slides", src: docs.slides ?? null },
      { kind: "filings", src: tsmcFilingsUrlFromPackage(docs) },
    ];

    const updates: {
      slides_url?: string;
      filings_url?: string;
      slides_locked?: boolean;
      filings_locked?: boolean;
      resolution_note?: string;
      verified_at?: string;
      updated_at?: string;
    } = {};

    for (const { kind, src } of jobs) {
      if (!src) {
        fail += 1;
        continue;
      }
      const objectPath = earningsIrDocObjectPath("TSM", end, kind);
      const publicUrl = earningsIrDocPublicUrl(url, objectPath);
      try {
        console.log(`  fetch ${end} ${kind}`);
        const body = await downloadPdfViaPage(page, src);
        const { error: upErr } = await admin.storage.from(EARNINGS_IR_DOCS_BUCKET).upload(objectPath, body, {
          contentType: "application/pdf",
          upsert: true,
          cacheControl: "public, max-age=86400",
        });
        if (upErr) throw new Error(upErr.message);
        if (kind === "slides") {
          updates.slides_url = publicUrl;
          updates.slides_locked = true;
        } else {
          updates.filings_url = publicUrl;
          updates.filings_locked = true;
        }
        console.log(`  ok ${objectPath} (${body.length} bytes)`);
        ok += 1;
      } catch (e) {
        fail += 1;
        console.error(`  FAIL ${end} ${kind}:`, e);
      }
    }

    if (updates.slides_url || updates.filings_url) {
      updates.resolution_note = "Mirrored TSMC IR PDF via browser (CF) to earnings-ir-docs";
      updates.verified_at = new Date().toISOString();
      updates.updated_at = new Date().toISOString();
      const { error: updErr } = await admin
        .from("earnings_ir_vault")
        .update(updates)
        .eq("ticker", "TSM")
        .eq("fiscal_period_end", end);
      if (updErr) {
        fail += 1;
        console.error(`  vault update failed ${end}:`, updErr.message);
      }
    }
  }

  await browser.close();
  console.log(JSON.stringify({ ok, fail }, null, 2));
  if (fail > 0) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
