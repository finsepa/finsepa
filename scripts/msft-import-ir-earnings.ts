/**
 * Import MSFT earnings transcripts + audio from Microsoft IR (official).
 *
 * Transcripts: aka.ms → cdn-dynmedia DOCX (microsoftcorp/Transcript…)
 * Audio: Medius webcast embed → HLS audio (or HIGHMP4 fallback)
 *
 *   npx tsx scripts/msft-import-ir-earnings.ts
 *   npx tsx scripts/msft-import-ir-earnings.ts --only=q4-2026,q3-2026
 *   npx tsx scripts/msft-import-ir-earnings.ts --skip-audio
 *
 * See docs/earnings-transcript-audio.md
 */

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

type Quarter = {
  slug: string;
  fiscalPeriodLabel: string;
  eventDateYmd: string;
  eventUrl: string;
  /** Direct DOCX/content URL on Microsoft CDN (resolved from aka.ms). */
  transcriptUrl: string;
  /** Medius embed UUID when the IR page still hosts the webcast. */
  mediusId: string | null;
};

/** Six most recent Microsoft FY quarters with durable IR materials. */
const QUARTERS: Quarter[] = [
  {
    slug: "q4-2026",
    fiscalPeriodLabel: "Q4 2026",
    eventDateYmd: "2026-07-29",
    eventUrl: "https://www.microsoft.com/en-us/investor/events/fy-2026/earnings-fy-2026-q4",
    transcriptUrl: "https://cdn-dynmedia-1.microsoft.com/is/content/microsoftcorp/TranscriptFY26Q4.docx",
    mediusId: "55b7ccb2-44c5-4ddd-8c69-696af249231f",
  },
  {
    slug: "q3-2026",
    fiscalPeriodLabel: "Q3 2026",
    eventDateYmd: "2026-04-29",
    eventUrl: "https://www.microsoft.com/en-us/investor/events/fy-2026/earnings-fy-2026-q3",
    transcriptUrl: "https://cdn-dynmedia-1.microsoft.com/is/content/microsoftcorp/TranscriptQandAFY26Q3",
    mediusId: "547ca906-a8b4-4f7a-bd53-844a9032fb54",
  },
  {
    slug: "q2-2026",
    fiscalPeriodLabel: "Q2 2026",
    eventDateYmd: "2026-01-28",
    eventUrl: "https://www.microsoft.com/en-us/investor/events/fy-2026/earnings-fy-2026-q2",
    transcriptUrl: "https://cdn-dynmedia-1.microsoft.com/is/content/microsoftcorp/TranscriptQandAFY26q2",
    mediusId: "61d9a257-6b57-4953-98f0-7c49ed2dce32",
  },
  {
    slug: "q1-2026",
    fiscalPeriodLabel: "Q1 2026",
    eventDateYmd: "2025-10-29",
    eventUrl: "https://www.microsoft.com/en-us/investor/events/fy-2026/earnings-fy-2026-q1",
    transcriptUrl: "https://cdn-dynmedia-1.microsoft.com/is/content/microsoftcorp/TranscriptFY26Q1.docx",
    mediusId: "3877d0ae-114a-4e2e-9a17-85f3b7a81502",
  },
  {
    slug: "q4-2025",
    fiscalPeriodLabel: "Q4 2025",
    eventDateYmd: "2025-07-30",
    eventUrl: "https://www.microsoft.com/en-us/investor/events/fy-2025/earnings-fy-2025-q4",
    transcriptUrl: "https://cdn-dynmedia-1.microsoft.com/is/content/microsoftcorp/TranscriptQandAFY25q4.docx",
    mediusId: "15ea4a91-4aea-4da4-b94b-77b4613af6f5",
  },
  {
    slug: "q3-2025",
    fiscalPeriodLabel: "Q3 2025",
    eventDateYmd: "2025-04-30",
    eventUrl: "https://www.microsoft.com/en-us/investor/events/fy-2025/earnings-fy-2025-q3",
    transcriptUrl: "https://cdn-dynmedia-1.microsoft.com/is/content/microsoftcorp/TranscriptFY25Q3",
    // IR Medius replay removed after ~1 year; audio filled via YouTube if needed.
    mediusId: null,
  },
];

/** YouTube fallback when Medius replay expired (~1 year). Prefer full-call uploads. */
const YOUTUBE_FALLBACK: Record<string, string> = {
  "q3-2025": "https://www.youtube.com/watch?v=DtSZ5uQvW_8",
};

type Speaker = { id: number; name: string; role: string | null; isOperator?: boolean };
type Para = {
  speakerId: number;
  text: string;
  startSec?: number;
  endSec?: number;
  words?: { text: string; startSec: number; endSec: number }[];
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

function guessRole(name: string, roleFromHeader: string | null): { role: string | null; isOperator?: boolean } {
  if (/^operator$/i.test(name)) return { role: null, isOperator: true };
  if (roleFromHeader) return { role: roleFromHeader };
  if (/neilson/i.test(name)) return { role: "VP, Investor Relations" };
  if (/nadella/i.test(name)) return { role: "Chairman and CEO" };
  if (/amy hood|hood/i.test(name)) return { role: "EVP and CFO" };
  return { role: "Analyst" };
}

function titleCaseName(raw: string): string {
  return raw
    .trim()
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

function extractDocxParagraphs(docxPath: string): string[] {
  const py = `
import sys, zipfile
from xml.etree import ElementTree as ET
path = sys.argv[1]
with zipfile.ZipFile(path) as z:
    xml = z.read("word/document.xml")
root = ET.fromstring(xml)
paras = []
for p in root.iter("{http://schemas.openxmlformats.org/wordprocessingml/2006/main}p"):
    texts = [t.text or "" for t in p.iter("{http://schemas.openxmlformats.org/wordprocessingml/2006/main}t")]
    line = "".join(texts).strip()
    if line:
        paras.append(line)
sys.stdout.write("\\n".join(paras))
`;
  const run = spawnSync("python3", ["-c", py, docxPath], {
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024,
  });
  if (run.status !== 0) throw new Error(`docx extract failed: ${run.stderr?.slice(0, 400)}`);
  return (run.stdout || "").split("\n").filter((l) => l.trim().length > 0);
}

/** Parse Microsoft IR DOCX lines into speakers + paragraphs. */
function parseMsftTranscript(lines: string[]): { speakers: Speaker[]; paragraphs: Para[] } {
  const speakerMap = new Map<string, number>();
  const speakers: Speaker[] = [];
  const paragraphs: Para[] = [];

  function speakerIdFor(nameRaw: string, roleRaw: string | null): number {
    const name = /^operator$/i.test(nameRaw) ? "Operator" : titleCaseName(nameRaw);
    const key = name.toLowerCase();
    if (!speakerMap.has(key)) {
      const id = speakers.length;
      speakerMap.set(key, id);
      const meta = guessRole(name, roleRaw);
      speakers.push({
        id,
        name,
        role: meta.role,
        ...(meta.isOperator ? { isOperator: true } : {}),
      });
    }
    return speakerMap.get(key)!;
  }

  // NAME: | NAME, Firm:  (ALL CAPS or Title Case), optionally followed by body on same line
  const headerRe =
    /^((?:OPERATOR)|(?:[A-Z][A-Z'\-]*(?:\s+[A-Z][A-Z'\-]*)+)|(?:[A-Z][a-zA-Z'\-]+(?:\s+[A-Z][a-zA-Z'\-]+)+))(?:\s*,\s*([^:]{1,80}))?\s*:\s*(.*)$/;

  let currentSid: number | null = null;
  let buf = "";

  function flush() {
    const text = buf.replace(/\s+/g, " ").trim();
    if (currentSid != null && text.length >= 8) {
      paragraphs.push({ speakerId: currentSid, text });
    }
    buf = "";
  }

  for (const raw of lines) {
    const line = raw.replace(/\u2011/g, "-").replace(/\u2013|\u2014/g, "-").trim();
    if (!line || /^\(Operator Direction\.\)$/i.test(line)) continue;

    const m = line.match(headerRe);
    if (m) {
      flush();
      const namePart = m[1]!.trim();
      const firm = m[2]?.trim() || null;
      const rest = (m[3] || "").trim();
      currentSid = speakerIdFor(namePart, firm);
      buf = rest;
      continue;
    }

    if (currentSid == null) continue;
    buf = buf ? `${buf} ${line}` : line;
  }
  flush();

  // Split long monologues into sentence chunks for karaoke granularity
  const expanded: Para[] = [];
  for (const p of paragraphs) {
    const sentences = p.text
      .split(/(?<=[.!?])\s+(?=[A-Z“"'])/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    if (sentences.length <= 1) {
      expanded.push(p);
      continue;
    }
    let chunk = "";
    for (const s of sentences) {
      if (!chunk) {
        chunk = s;
        continue;
      }
      if (chunk.length + 1 + s.length > 420) {
        expanded.push({ speakerId: p.speakerId, text: chunk });
        chunk = s;
      } else {
        chunk = `${chunk} ${s}`;
      }
    }
    if (chunk) expanded.push({ speakerId: p.speakerId, text: chunk });
  }

  return { speakers, paragraphs: expanded };
}

function wordsFromDuration(
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

function applyProportionalTimings(paragraphs: Para[], durationSec: number): Para[] {
  const weights = paragraphs.map((p) => Math.max(1, p.text.split(/\s+/).filter(Boolean).length));
  const total = weights.reduce((a, b) => a + b, 0);
  let cursor = 0;
  return paragraphs.map((p, i) => {
    const share = weights[i]! / total;
    const startSec = cursor;
    const endSec = i === paragraphs.length - 1 ? durationSec : cursor + share * durationSec;
    cursor = endSec;
    return {
      ...p,
      startSec: Math.round(startSec * 100) / 100,
      endSec: Math.round(endSec * 100) / 100,
      words: wordsFromDuration(p.text, startSec, endSec),
    };
  });
}

function probeDurationSec(mp3Path: string): number | null {
  const probe = spawnSync(
    "ffprobe",
    ["-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", mp3Path],
    { encoding: "utf8" },
  );
  const n = Number(probe.stdout?.trim());
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null;
}

function downloadFile(url: string, dest: string) {
  mkdirSync(path.dirname(dest), { recursive: true });
  const curl = spawnSync(
    "curl",
    ["-L", "--fail", "-A", "Mozilla/5.0", "-e", "https://www.microsoft.com/", "-o", dest, url],
    { encoding: "utf8" },
  );
  if (curl.status !== 0) throw new Error(`download failed: ${curl.stderr?.slice(0, 300)}`);
}

function resolveMediusAudioM3u8(mediusId: string): string {
  const embedUrl = `https://medius.microsoft.com/Embed/video-nc/${mediusId}`;
  const htmlPath = path.join("/tmp", `msft-medius-${mediusId}.html`);
  downloadFile(embedUrl, htmlPath);
  const html = spawnSync("cat", [htmlPath], { encoding: "utf8", maxBuffer: 5 * 1024 * 1024 }).stdout || "";
  const manifests = [...html.matchAll(/"manifest"\s*:\s*"(https:\/\/stream\.event\.microsoft\.com[^"]+\.m3u8)"/g)].map(
    (m) => m[1]!,
  );
  const preferred = manifests.find((u) => u.includes("/prodwe/")) || manifests[0];
  if (!preferred) throw new Error(`no HLS manifest in Medius embed ${mediusId}`);
  // Prefer audio-only group if master lists Stream(08)
  const master = spawnSync(
    "curl",
    ["-sL", "--fail", "-A", "Mozilla/5.0", "-e", "https://medius.microsoft.com/", preferred],
    { encoding: "utf8" },
  );
  if (master.status !== 0) throw new Error(`master m3u8 failed: ${master.stderr?.slice(0, 200)}`);
  const audioUri = (master.stdout || "").match(/TYPE=AUDIO[^\n]*URI="([^"]+)"/);
  if (audioUri?.[1]) {
    return new URL(audioUri[1]!, preferred).toString();
  }
  return preferred;
}

function downloadMediusMp3(mediusId: string, destMp3: string) {
  mkdirSync(path.dirname(destMp3), { recursive: true });
  const m3u8 = resolveMediusAudioM3u8(mediusId);
  console.log("hls", m3u8);
  const run = spawnSync(
    "ffmpeg",
    [
      "-y",
      "-headers",
      "Referer: https://medius.microsoft.com/\r\nUser-Agent: Mozilla/5.0\r\n",
      "-i",
      m3u8,
      "-vn",
      "-acodec",
      "libmp3lame",
      "-q:a",
      "4",
      destMp3,
    ],
    { encoding: "utf8" },
  );
  if (run.status !== 0) {
    throw new Error(`ffmpeg medius failed: ${(run.stderr || "").slice(-500)}`);
  }
  if (!existsSync(destMp3)) throw new Error(`missing ${destMp3}`);

  // Some Medius HLS audio tracks are truncated; fall back to HIGHMP4 VOD.
  const dur = probeDurationSec(destMp3);
  if (dur != null && dur >= 900) return;

  console.warn(`HLS audio short (${dur}s) — falling back to HIGHMP4…`);
  const mp4 = path.join("/tmp", `msft-${mediusId}.mp4`);
  downloadFile(`https://medius.microsoft.com/video/asset/HIGHMP4/${mediusId}`, mp4);
  const ff = spawnSync(
    "ffmpeg",
    ["-y", "-i", mp4, "-vn", "-acodec", "libmp3lame", "-q:a", "4", destMp3],
    { encoding: "utf8" },
  );
  if (ff.status !== 0) {
    throw new Error(`ffmpeg HIGHMP4 failed: ${(ff.stderr || "").slice(-500)}`);
  }
}

function downloadYoutubeMp3(youtubeUrl: string, destMp3: string) {
  mkdirSync(path.dirname(destMp3), { recursive: true });
  const tmpBase = destMp3.replace(/\.mp3$/i, "");
  const run = spawnSync(
    "yt-dlp",
    [
      "-f",
      "bestaudio/best",
      "-x",
      "--audio-format",
      "mp3",
      "--audio-quality",
      "4",
      "-o",
      `${tmpBase}.%(ext)s`,
      "--no-playlist",
      "--force-overwrites",
      youtubeUrl,
    ],
    { encoding: "utf8" },
  );
  if (run.status !== 0) {
    throw new Error(`yt-dlp failed: ${(run.stderr || run.stdout || "").slice(0, 500)}`);
  }
  if (!existsSync(destMp3)) throw new Error(`yt-dlp did not produce ${destMp3}`);
}

async function main() {
  const only = argList("only");
  const force = hasFlag("force");
  const skipAudio = hasFlag("skip-audio");
  const quarters = only ? QUARTERS.filter((q) => only.includes(q.slug)) : QUARTERS;

  const fixtureDir = path.join("lib/market/fixtures");
  const audioDir = path.join("public/earnings-audio/MSFT");
  const workDir = path.join("tmp/msft-ir");
  mkdirSync(fixtureDir, { recursive: true });
  mkdirSync(audioDir, { recursive: true });
  mkdirSync(workDir, { recursive: true });

  const results: { slug: string; status: string }[] = [];
  const index: unknown[] = [];

  for (const q of quarters) {
    console.log(`\n=== ${q.fiscalPeriodLabel} (${q.slug}) ===`);
    const fixturePath = path.join(fixtureDir, `msft-${q.slug}-transcript.json`);
    const mp3Path = path.join(audioDir, `${q.slug}.mp3`);
    const docxPath = path.join(workDir, `${q.slug}.docx`);

    if (!existsSync(docxPath) || force) {
      console.log("downloading transcript…", q.transcriptUrl);
      try {
        downloadFile(q.transcriptUrl, docxPath);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        results.push({ slug: q.slug, status: `fail transcript: ${msg}` });
        continue;
      }
    }

    let lines: string[];
    try {
      lines = extractDocxParagraphs(docxPath);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      results.push({ slug: q.slug, status: `fail extract: ${msg}` });
      continue;
    }
    writeFileSync(path.join(workDir, `${q.slug}.txt`), lines.join("\n") + "\n");
    const parsed = parseMsftTranscript(lines);
    console.log("speakers", parsed.speakers.length, "paras", parsed.paragraphs.length);
    if (parsed.paragraphs.length < 10) {
      results.push({ slug: q.slug, status: "fail: too few paragraphs" });
      continue;
    }

    if (!skipAudio && (!existsSync(mp3Path) || force)) {
      try {
        if (q.mediusId) {
          console.log("downloading Medius audio…", q.mediusId);
          downloadMediusMp3(q.mediusId, mp3Path);
        } else {
          const yt = YOUTUBE_FALLBACK[q.slug];
          if (!yt) throw new Error("no Medius id and no YouTube fallback");
          console.log("Medius unavailable — YouTube fallback…", yt);
          downloadYoutubeMp3(yt, mp3Path);
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error("audio fail", msg);
        results.push({ slug: q.slug, status: `fail audio: ${msg}` });
        // Still write transcript-only fixture below if audio fails? Prefer fail loud for parity with GOOGL.
        continue;
      }
    }

    const durationSec = existsSync(mp3Path) ? probeDurationSec(mp3Path) : null;
    let paragraphs = parsed.paragraphs;
    let audioSync: string | undefined;
    if (durationSec != null) {
      paragraphs = applyProportionalTimings(paragraphs, durationSec);
      audioSync = "ir-docx-proportional";
    }

    const fixture = {
      ticker: "MSFT" as const,
      companyName: "Microsoft",
      fiscalPeriodLabel: q.fiscalPeriodLabel,
      eventDateYmd: q.eventDateYmd,
      eventTitle: `${q.fiscalPeriodLabel} earnings call`,
      sourceUrl: q.transcriptUrl,
      audioUrl: existsSync(mp3Path) ? `/earnings-audio/MSFT/${q.slug}.mp3` : undefined,
      durationSec: durationSec ?? undefined,
      audioSync,
      speakers: parsed.speakers,
      paragraphs,
    };

    writeFileSync(fixturePath, JSON.stringify(fixture, null, 2) + "\n");
    console.log("wrote", fixturePath);

    index.push({
      fiscalPeriodLabel: q.fiscalPeriodLabel,
      eventDateYmd: q.eventDateYmd,
      fixtureFile: `msft-${q.slug}-transcript.json`,
      audioFile: `${q.slug}.mp3`,
      sourceUrl: q.transcriptUrl,
      eventUrl: q.eventUrl,
      mediusId: q.mediusId,
    });

    results.push({ slug: q.slug, status: "ok" });
  }

  writeFileSync(path.join(fixtureDir, "msft-transcript-index.json"), JSON.stringify(index, null, 2) + "\n");
  writeFileSync("tmp/msft-ir-import-status.json", JSON.stringify({ results }, null, 2) + "\n");
  console.log("\nSummary");
  console.table(results);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
