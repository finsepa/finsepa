/**
 * Capture AAPL earnings audio from Apple’s official Podcasts / Art19 RSS
 * (same first-party window Quartr uses — ~2 weeks after the call).
 *
 *   npx tsx scripts/aapl-capture-earnings-audio.ts
 *   npx tsx scripts/aapl-capture-earnings-audio.ts --only=q4-2026
 *   npx tsx scripts/aapl-capture-earnings-audio.ts --list
 *   npx tsx scripts/aapl-capture-earnings-audio.ts --force
 *
 * Writes: public/earnings-audio/AAPL/{slug}.mp3
 * Status: tmp/aapl-capture-status.json
 *
 * Outside the replay window the feed usually contains only a short PSA —
 * then there is nothing to capture from Apple. Do not scrape Quartr instead.
 */

import { copyFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const FEED_URL = "https://rss.art19.com/apple-quarterly-earnings-call";
const OUT_DIR = path.join("public/earnings-audio/AAPL");
const MIN_DURATION_SEC = 60; // skip PSA stubs (~16s)

type Episode = {
  title: string;
  pubDate: string;
  enclosureUrl: string;
  durationSec: number;
  slug: string | null;
};

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

function parseDuration(raw: string | undefined): number {
  if (!raw) return 0;
  const t = raw.trim();
  if (/^\d+$/.test(t)) return Number(t);
  const parts = t.split(":").map((p) => Number(p));
  if (parts.some((n) => Number.isNaN(n))) return 0;
  if (parts.length === 3) return parts[0]! * 3600 + parts[1]! * 60 + parts[2]!;
  if (parts.length === 2) return parts[0]! * 60 + parts[1]!;
  return 0;
}

/**
 * Map Apple episode titles → fiscal slug.
 * Examples: "Q3FY26 Apple Quarterly Earnings Call", "Q1 FY2025 Earnings"
 */
function slugFromTitle(title: string): string | null {
  const t = title.replace(/\s+/g, " ").trim();
  if (/PSA|placeholder|receive the next/i.test(t)) return null;

  let m = t.match(/\bQ([1-4])\s*FY\s*(\d{2,4})\b/i);
  if (!m) m = t.match(/\bQ([1-4])FY(\d{2,4})\b/i);
  if (!m) m = t.match(/\bQ([1-4])\s+(\d{4})\b/i);
  if (!m) return null;

  const q = m[1]!;
  let year = m[2]!;
  if (year.length === 2) year = `20${year}`;
  return `q${q}-${year}`;
}

function decodeXml(s: string): string {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

function parseFeed(xml: string): Episode[] {
  const items = xml.split(/<item>/i).slice(1);
  const out: Episode[] = [];
  for (const chunk of items) {
    const block = chunk.split(/<\/item>/i)[0] ?? chunk;
    const title = decodeXml((block.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || "");
    const pubDate = decodeXml((block.match(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>/i) || [])[1] || "");
    const enclosureUrl =
      (block.match(/<enclosure[^>]+url=["']([^"']+)["']/i) || [])[1] ||
      (block.match(/url=["'](https?:\/\/[^"']+\.mp3[^"']*)["']/i) || [])[1] ||
      "";
    const durationRaw =
      (block.match(/<itunes:duration[^>]*>([\s\S]*?)<\/itunes:duration>/i) || [])[1] ||
      (block.match(/<duration[^>]*>([\s\S]*?)<\/duration>/i) || [])[1];
    const durationSec = parseDuration(durationRaw ? decodeXml(durationRaw) : undefined);
    if (!title || !enclosureUrl) continue;
    out.push({
      title,
      pubDate,
      enclosureUrl,
      durationSec,
      slug: slugFromTitle(title),
    });
  }
  return out;
}

async function downloadMp3(url: string, dest: string): Promise<void> {
  const res = await fetch(url, {
    headers: {
      "User-Agent": "FinsepaEarningsCapture/1.0 (+https://finsepa.com)",
      Accept: "audio/mpeg,audio/*,*/*",
    },
    redirect: "follow",
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.byteLength < 50_000) {
    throw new Error(`file too small (${buf.byteLength} bytes) — likely expired PSA/redirect`);
  }
  writeFileSync(dest, buf);
}

function ensureMp3Codec(src: string, dest: string): void {
  if (src === dest) return;
  const r = spawnSync(
    "ffmpeg",
    ["-y", "-i", src, "-vn", "-acodec", "libmp3lame", "-q:a", "4", dest],
    { encoding: "utf8" },
  );
  if (r.status !== 0) {
    throw new Error(`ffmpeg failed: ${r.stderr?.slice(0, 400)}`);
  }
}

async function main() {
  const only = argList("only");
  const force = hasFlag("force");
  const listOnly = hasFlag("list");

  mkdirSync(OUT_DIR, { recursive: true });
  mkdirSync("tmp", { recursive: true });

  console.log("Fetching", FEED_URL);
  const feedRes = await fetch(FEED_URL, {
    headers: { "User-Agent": "FinsepaEarningsCapture/1.0 (+https://finsepa.com)" },
  });
  if (!feedRes.ok) throw new Error(`feed HTTP ${feedRes.status}`);
  const xml = await feedRes.text();
  const episodes = parseFeed(xml);

  console.log(`\nFeed items: ${episodes.length}`);
  for (const ep of episodes) {
    console.log(
      `  - ${ep.slug ?? "(no slug)"} | ${ep.durationSec}s | ${ep.title.slice(0, 60)} | ${ep.pubDate}`,
    );
  }

  if (listOnly) {
    writeFileSync(
      "tmp/aapl-capture-status.json",
      JSON.stringify({ listedAt: new Date().toISOString(), episodes }, null, 2) + "\n",
    );
    return;
  }

  const capturable = episodes.filter(
    (ep) => ep.slug && ep.durationSec >= MIN_DURATION_SEC && ep.enclosureUrl,
  );

  if (capturable.length === 0) {
    console.log(
      "\nNo capturable earnings episodes in the feed (window closed or PSA-only).\n" +
        "Apple keeps replays ~2 weeks — run this again within that window after the next call.\n" +
        "See docs/earnings-transcript-audio.md",
    );
    writeFileSync(
      "tmp/aapl-capture-status.json",
      JSON.stringify(
        {
          capturedAt: new Date().toISOString(),
          results: [],
          note: "feed has no full earnings episode — Apple ~2-week window likely closed",
          episodes,
        },
        null,
        2,
      ) + "\n",
    );
    return;
  }

  const results: { slug: string; status: string; title?: string }[] = [];

  for (const ep of capturable) {
    const slug = ep.slug!;
    if (only && !only.includes(slug)) continue;

    const dest = path.join(OUT_DIR, `${slug}.mp3`);
    if (existsSync(dest) && !force) {
      results.push({ slug, status: "skip (exists)", title: ep.title });
      console.log(`SKIP ${slug} — already have ${dest}`);
      continue;
    }

    console.log(`\n=== Capturing ${slug} ===`);
    console.log(ep.title);
    console.log(ep.enclosureUrl);

    try {
      const tmpRaw = path.join("/tmp", `aapl-${slug}-art19.bin`);
      await downloadMp3(ep.enclosureUrl, tmpRaw);
      // Art19 serves MPEG; normalize via ffmpeg when available, else copy bytes.
      const ff = spawnSync("ffmpeg", ["-version"], { encoding: "utf8" });
      if (ff.status === 0) {
        ensureMp3Codec(tmpRaw, dest);
      } else {
        copyFileSync(tmpRaw, dest);
      }
      results.push({ slug, status: "ok", title: ep.title });
      console.log("wrote", dest);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("FAIL", slug, msg);
      results.push({ slug, status: `fail: ${msg}`, title: ep.title });
    }
  }

  console.log("\nSummary");
  console.table(results);
  writeFileSync(
    "tmp/aapl-capture-status.json",
    JSON.stringify({ capturedAt: new Date().toISOString(), results, episodes }, null, 2) + "\n",
  );
  console.log(
    "\nNext: build/refresh transcript fixture from this MP3 (Whisper ASR), then:\n" +
      "  npx tsx --env-file=.env.local scripts/aapl-align-all-earnings-audio.ts",
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
