/**
 * Import AAPL earnings transcripts + Quartr audio from stockanalysis pages.
 *
 *   npx tsx scripts/aapl-import-earnings-transcripts.ts
 *   npx tsx scripts/aapl-import-earnings-transcripts.ts --only=q3-2026,q2-2026
 *
 * Writes:
 *   lib/market/fixtures/aapl-{slug}-transcript.json
 *   public/earnings-audio/AAPL/{slug}.mp3
 */

import { existsSync, mkdirSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { chromium } from "playwright";
import { copyFileSync } from "node:fs";

/** Recent Apple FY quarters with stockanalysis transcript pages. */
const QUARTERS: Quarter[] = [
  { slug: "q3-2026", pathId: "658553-q3-2026", fiscalPeriodLabel: "Q3 2026", eventDateYmd: "2026-07-31" },
  { slug: "q2-2026", pathId: "548666-q2-2026", fiscalPeriodLabel: "Q2 2026", eventDateYmd: "2026-05-01" },
  { slug: "q1-2026", pathId: "406161-q1-2026", fiscalPeriodLabel: "Q1 2026", eventDateYmd: "2026-01-29" },
  { slug: "q4-2025", pathId: "369370-q4-2025", fiscalPeriodLabel: "Q4 2025", eventDateYmd: "2025-10-30" },
  { slug: "q3-2025", pathId: "341149-q3-2025", fiscalPeriodLabel: "Q3 2025", eventDateYmd: "2025-07-31" },
  { slug: "q2-2025", pathId: "311069-q2-2025", fiscalPeriodLabel: "Q2 2025", eventDateYmd: "2025-05-01" },
];

type Quarter = {
  slug: string;
  pathId: string;
  fiscalPeriodLabel: string;
  eventDateYmd: string;
};

type Speaker = { id: number; name: string; role: string | null; isOperator?: boolean };
type Para = {
  speakerId: number;
  text: string;
  startSec?: number;
  endSec?: number;
  words?: { text: string; startSec: number; endSec: number }[];
};

function wordsFromSentence(
  text: string,
  startSec: number,
  endSec: number,
): { text: string; startSec: number; endSec: number }[] {
  const tokens = text.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return [];
  const span = Math.max(0.05, endSec - startSec);
  return tokens.map((tok, i) => {
    const t0 = startSec + (i / tokens.length) * span;
    const t1 = startSec + ((i + 1) / tokens.length) * span;
    return {
      text: tok,
      startSec: Math.round(t0 * 100) / 100,
      endSec: Math.round(t1 * 100) / 100,
    };
  });
}

function argList(name: string): string[] | null {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  if (!hit) return null;
  return hit
    .slice(name.length + 3)
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

function decodeHtml(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function guessRole(name: string): { role: string | null; isOperator?: boolean } {
  const n = name.trim();
  if (/^operator$/i.test(n)) return { role: null, isOperator: true };
  if (/chandramouli|suhasini/i.test(n)) return { role: "Director of Investor Relations" };
  if (/tim cook/i.test(n)) return { role: "CEO" };
  if (/kevan|parekh/i.test(n)) return { role: "CFO" };
  if (/luca maestri/i.test(n)) return { role: "CFO" };
  return { role: "Analyst" };
}

type ParsedPage = {
  audioUrl: string | null;
  eventDateYmd: string | null;
  sourceUrl: string;
  speakers: Speaker[];
  paragraphs: Para[];
  durationSec: number | null;
};

function parseTranscriptHtml(html: string, pageUrl: string): ParsedPage {
  const audioMatch = html.match(/audioUrl:"(https:\\?\/\\?\/[^"]+)"/);
  let audioUrl = audioMatch?.[1]?.replace(/\\\//g, "/") ?? null;
  if (!audioUrl) {
    const m2 = html.match(/audioUrl":"(https:[^"]+)"/);
    audioUrl = m2?.[1]?.replace(/\\u002F/g, "/").replace(/\\\//g, "/") ?? null;
  }

  // Prefer ISO date near the transcript payload
  const dateMatch =
    html.match(/"datePublished":"(\d{4}-\d{2}-\d{2})/) ||
    html.match(/datePublished":"(\d{4}-\d{2}-\d{2})/) ||
    html.match(/"date":"(\d{4}-\d{2}-\d{2})T/);
  const eventDateYmd = dateMatch?.[1] ?? null;

  // Split into speaker sections
  const sectionRe =
    /<div class="text-lg font-bold[^"]*">([^<]+)<\/div>([\s\S]*?)(?=<div class="border-t border-sharp|<div class="text-lg font-bold|$)/g;
  const speakerMap = new Map<string, number>();
  const speakers: Speaker[] = [];
  const paragraphs: Para[] = [];
  let maxEnd = 0;

  let m: RegExpExecArray | null;
  while ((m = sectionRe.exec(html))) {
    const name = decodeHtml(m[1]!);
    if (!name) continue;
    if (!speakerMap.has(name)) {
      const id = speakers.length;
      speakerMap.set(name, id);
      const meta = guessRole(name);
      speakers.push({
        id,
        name,
        role: meta.role,
        ...(meta.isOperator ? { isOperator: true } : {}),
      });
    }
    const speakerId = speakerMap.get(name)!;
    const chunk = m[2]!;
    const sents = [
      ...chunk.matchAll(
        /data-start-sec="([0-9.]+)"\s+data-end-sec="([0-9.]+)"[^>]*>([^<]*)/g,
      ),
    ].map((x) => ({
      start: Number(x[1]),
      end: Number(x[2]),
      text: decodeHtml(x[3] || ""),
    })).filter((s) => s.text.length > 0);

    if (sents.length === 0) {
      // Fallback: plain paragraph text without timings
      const plain = decodeHtml(chunk.replace(/<[^>]+>/g, " "));
      if (plain.length > 20) {
        paragraphs.push({ speakerId, text: plain });
      }
      continue;
    }

    const text = sents.map((s) => s.text).join(" ");
    const startSec = sents[0]!.start;
    const endSec = sents[sents.length - 1]!.end;
    maxEnd = Math.max(maxEnd, endSec);
    const words = sents.flatMap((s) => wordsFromSentence(s.text, s.start, s.end));
    paragraphs.push({
      speakerId,
      text,
      startSec: Math.round(startSec * 100) / 100,
      endSec: Math.round(endSec * 100) / 100,
      words,
    });
  }

  return {
    audioUrl,
    eventDateYmd,
    sourceUrl: pageUrl,
    speakers,
    paragraphs,
    durationSec: maxEnd > 0 ? Math.round(maxEnd * 100) / 100 : null,
  };
}

async function downloadAudio(url: string, destMp3: string) {
  mkdirSync(path.dirname(destMp3), { recursive: true });
  const tmp = destMp3.replace(/\.mp3$/i, ".mpeg");
  const curl = spawnSync(
    "curl",
    [
      "-L",
      "--fail",
      "--progress-bar",
      "-A",
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
      "-e",
      "https://stockanalysis.com/",
      "-o",
      tmp,
      url,
    ],
    { encoding: "utf8" },
  );
  if (curl.status !== 0) {
    throw new Error(`curl failed: ${curl.stderr?.slice(0, 300)}`);
  }
  // Re-encode to consistent mp3 if needed (mpeg may already be mp3)
  const probe = spawnSync("ffprobe", ["-v", "error", "-show_entries", "format=format_name", "-of", "default=nw=1:nk=1", tmp], {
    encoding: "utf8",
  });
  const fmt = (probe.stdout || "").trim();
  if (/mp3|mpeg/i.test(fmt) || tmp.endsWith(".mpeg")) {
    const ff = spawnSync(
      "ffmpeg",
      ["-y", "-i", tmp, "-vn", "-acodec", "libmp3lame", "-q:a", "4", destMp3],
      { encoding: "utf8" },
    );
    if (ff.status !== 0) {
      // Already playable — copy
      spawnSync("cp", [tmp, destMp3]);
    }
  } else {
    copyFileSync(tmp, destMp3);
  }
  try {
    unlinkSync(tmp);
  } catch {
    /* ignore */
  }
}

async function main() {
  const only = argList("only");
  const force = hasFlag("force");
  const quarters = only ? QUARTERS.filter((q) => only.includes(q.slug)) : QUARTERS;

  const fixtureDir = path.join("lib/market/fixtures");
  const audioDir = path.join("public/earnings-audio/AAPL");
  mkdirSync(fixtureDir, { recursive: true });
  mkdirSync(audioDir, { recursive: true });
  mkdirSync("tmp", { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
  });
  const results: { slug: string; status: string }[] = [];

  try {
    for (const q of quarters) {
      const fixturePath = path.join(fixtureDir, `aapl-${q.slug}-transcript.json`);
      const mp3Path = path.join(audioDir, `${q.slug}.mp3`);
      const pageUrl = `https://stockanalysis.com/stocks/aapl/transcripts/${q.pathId}/`;

      if (existsSync(fixturePath) && existsSync(mp3Path) && !force) {
        results.push({ slug: q.slug, status: "skip (exists)" });
        console.log(`SKIP ${q.slug}`);
        continue;
      }

      console.log(`\n=== ${q.fiscalPeriodLabel} (${q.slug}) ===`);
      const page = await context.newPage();
      try {
        await page.goto(pageUrl, { waitUntil: "domcontentloaded", timeout: 90_000 });
        // Wait for transcript body
        await page.waitForSelector(".transcript-sentence, text=Tim Cook, text=Operator", {
          timeout: 60_000,
        }).catch(() => undefined);
        await page.waitForTimeout(2000);
        const html = await page.content();
        const parsed = parseTranscriptHtml(html, pageUrl);
        console.log(
          "paras",
          parsed.paragraphs.length,
          "speakers",
          parsed.speakers.length,
          "audio",
          !!parsed.audioUrl,
          "date",
          parsed.eventDateYmd,
        );

        if (parsed.paragraphs.length < 5) {
          results.push({ slug: q.slug, status: "fail: too few paragraphs (CF?)" });
          writeFileSync(`tmp/aapl-${q.slug}-page.html`, html);
          continue;
        }

        if (parsed.audioUrl && !existsSync(mp3Path)) {
          console.log("downloading audio…");
          await downloadAudio(parsed.audioUrl, mp3Path);
          console.log("mp3", mp3Path);
        } else if (!parsed.audioUrl) {
          console.log("WARN: no audioUrl in page");
        } else {
          console.log("keeping existing mp3", mp3Path);
        }

        const fixture = {
          ticker: "AAPL" as const,
          companyName: "Apple",
          fiscalPeriodLabel: q.fiscalPeriodLabel,
          eventDateYmd: parsed.eventDateYmd ?? q.eventDateYmd,
          eventTitle: `${q.fiscalPeriodLabel} earnings call`,
          sourceUrl: pageUrl,
          audioUrl: existsSync(mp3Path) ? `/earnings-audio/AAPL/${q.slug}.mp3` : undefined,
          durationSec: parsed.durationSec ?? undefined,
          audioSync: parsed.paragraphs.some((p) => (p.words?.length ?? 0) > 0)
            ? "stockanalysis-sentence-words"
            : parsed.paragraphs.some((p) => p.startSec != null)
              ? "stockanalysis-sentences"
              : undefined,
          speakers: parsed.speakers,
          paragraphs: parsed.paragraphs,
        };

        writeFileSync(fixturePath, JSON.stringify(fixture, null, 2) + "\n");
        console.log("wrote", fixturePath);
        results.push({ slug: q.slug, status: "ok" });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error("FAIL", q.slug, msg);
        results.push({ slug: q.slug, status: `fail: ${msg}` });
      } finally {
        await page.close();
      }
    }
  } finally {
    await browser.close();
  }

  console.log("\nSummary");
  console.table(results);
  writeFileSync("tmp/aapl-import-status.json", JSON.stringify({ results }, null, 2) + "\n");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
