/**
 * Import GOOGL earnings transcripts + audio from Alphabet IR (official).
 *
 * Transcripts: PDF on abc.xyz / s206.q4cdn.com
 * Audio: YouTube webcast linked from the IR event page (yt-dlp → mp3)
 *
 *   npx tsx scripts/googl-import-ir-earnings.ts
 *   npx tsx scripts/googl-import-ir-earnings.ts --only=q2-2026,q1-2026
 *   npx tsx scripts/googl-import-ir-earnings.ts --skip-audio
 */

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

/** Alphabet IR “Webcast & Transcript” event pages (from abc.xyz/investor/earnings). */
const QUARTERS: Quarter[] = [
  {
    slug: "q2-2026",
    fiscalPeriodLabel: "Q2 2026",
    eventDateYmd: "2026-07-22",
    eventUrl:
      "https://abc.xyz/investor/events/event-details/2026/2026-Q2-Earnings-Call-2026-GgTAq7Is0z/default.aspx",
    pdfUrl: "https://s206.q4cdn.com/479360582/files/doc_events/2026/Jul/22/2026_Q2_Earnings_Transcript.pdf",
    youtubeUrl: "https://www.youtube.com/watch?v=LzExSq9DU9w",
  },
  {
    slug: "q1-2026",
    fiscalPeriodLabel: "Q1 2026",
    eventDateYmd: "2026-04-29",
    eventUrl:
      "https://abc.xyz/investor/events/event-details/2026/2026-Q1-Earnings-Call-2026-nW8kCrBAKS/default.aspx",
    pdfUrl:
      "https://s206.q4cdn.com/479360582/files/doc_events/2026/Apr/29/Alphabet-2026_Q1_Earnings_Transcript.pdf",
    youtubeUrl: "https://www.youtube.com/watch?v=LPJoiDiVkTI",
  },
  {
    slug: "q4-2025",
    fiscalPeriodLabel: "Q4 2025",
    eventDateYmd: "2026-02-04",
    eventUrl:
      "https://abc.xyz/investor/events/event-details/2026/2025-Q4-Earnings-Call-2026-Dr_C033hS6/default.aspx",
    pdfUrl: "https://s206.q4cdn.com/479360582/files/doc_events/2026/Feb/04/2025_Q4_Earnings_Transcript.pdf",
    youtubeUrl: "https://www.youtube.com/watch?v=mIK5-yi7a-c",
  },
  {
    slug: "q3-2025",
    fiscalPeriodLabel: "Q3 2025",
    eventDateYmd: "2025-10-29",
    eventUrl:
      "https://abc.xyz/investor/events/event-details/2025/2025-Q3-Earnings-Call-2025-4OI4Bac_Q9/default.aspx",
    pdfUrl: "https://s206.q4cdn.com/479360582/files/doc_events/2025/Oct/29/2025_Q3_Earnings_Transcript.pdf",
    youtubeUrl: "https://www.youtube.com/watch?v=hA1OEi6TRYU",
  },
  {
    slug: "q2-2025",
    fiscalPeriodLabel: "Q2 2025",
    eventDateYmd: "2025-07-23",
    eventUrl: "https://abc.xyz/investor/events/event-details/2025/2025-Q2-Earnings-Call",
    pdfUrl: "https://s206.q4cdn.com/479360582/files/doc_financials/2025/q2/2025-q2-earnings-transcript.pdf",
    // IR page webcast self-link is broken; official Alphabet YT upload:
    youtubeUrl: "https://www.youtube.com/watch?v=BtXRNTgsgpU",
  },
  {
    slug: "q1-2025",
    fiscalPeriodLabel: "Q1 2025",
    eventDateYmd: "2025-04-24",
    eventUrl: "https://abc.xyz/investor/events/event-details/2025/2025-Q1-Earnings-Call/default.aspx",
    pdfUrl: "https://s206.q4cdn.com/479360582/files/doc_financials/2025/q1/2025-q1-earnings-transcript.pdf",
    youtubeUrl: "https://www.youtube.com/watch?v=SySgINoaI9A",
  },
];

type Quarter = {
  slug: string;
  fiscalPeriodLabel: string;
  eventDateYmd: string;
  eventUrl: string;
  pdfUrl: string;
  youtubeUrl: string;
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
  if (/friedland/i.test(name)) return { role: "Head of Investor Relations" };
  if (/sundar|pichai/i.test(name)) return { role: "CEO" };
  if (/anat|ashkenazi/i.test(name)) return { role: "CFO" };
  if (/ruth porat/i.test(name)) return { role: "CFO" };
  if (/philipp|schindler/i.test(name)) return { role: "Chief Business Officer" };
  return { role: "Analyst" };
}

function extractPdfText(pdfPath: string): string {
  const py = `
import sys
from pypdf import PdfReader
reader = PdfReader(sys.argv[1])
text = "\\n".join((p.extract_text() or "") for p in reader.pages)
# Alphabet IR PDFs emit each word on its own line with a blank/space line between.
text = text.replace("\\u2011", "-").replace("\\u2013", "-").replace("\\u2014", "-")
text = text.replace("\\u2018", "'").replace("\\u2019", "'").replace("\\u201c", '"').replace("\\u201d", '"')
import re
text = re.sub(r"\\n[ \\t]*\\n", " ", text)
text = re.sub(r"[ \\t]+", " ", text)
# Soft-hyphen line breaks become "word - word" — glue back
text = re.sub(r"(\\w)\\s+-\\s+(\\w)", r"\\1-\\2", text)
text = re.sub(r" +", " ", text).strip()
sys.stdout.write(text)
`;
  const run = spawnSync("python3", ["-c", py, pdfPath], { encoding: "utf8", maxBuffer: 20 * 1024 * 1024 });
  if (run.status !== 0) {
    throw new Error(`pdf extract failed: ${run.stderr?.slice(0, 400)}`);
  }
  return run.stdout || "";
}

/** Split Alphabet IR transcript text into speaker paragraphs. */
function parseAlphabetTranscript(raw: string): { speakers: Speaker[]; paragraphs: Para[] } {
  // Drop boilerplate preface before first Operator:
  let text = raw;
  const opIdx = text.search(/\bOperator\s*:/);
  if (opIdx >= 0) text = text.slice(opIdx);

  // "Name:" | "Name, Title:" | "Name (Firm):"
  const headerRe =
    /((?:Operator)|(?:[A-Z][A-Za-z'\-]+(?:\s+[A-Z][A-Za-z'\-]+)+(?:\s*(?:,\s*[^.:()]{2,80}|\([^)]{2,60}\))?)))\s*:/g;

  const matches: { index: number; end: number; header: string }[] = [];
  let m: RegExpExecArray | null;
  while ((m = headerRe.exec(text))) {
    matches.push({ index: m.index, end: m.index + m[0].length, header: m[1]!.trim() });
  }

  // Dedupe overlapping matches; require Operator or ≥2 name tokens
  const cleaned: typeof matches = [];
  for (const hit of matches) {
    const last = cleaned[cleaned.length - 1];
    if (last && hit.index < last.end) continue;
    const namePart = hit.header.split(/[,(]/)[0]!.trim();
    if (!/^Operator$/i.test(namePart) && namePart.split(/\s+/).length < 2) continue;
    cleaned.push(hit);
  }

  const speakerMap = new Map<string, number>();
  const speakers: Speaker[] = [];
  const paragraphs: Para[] = [];

  function speakerIdFor(header: string): number {
    const paren = header.match(/^(.+?)\s*\(([^)]+)\)\s*$/);
    const comma = header.indexOf(",");
    let name: string;
    let roleRaw: string | null;
    if (paren) {
      name = paren[1]!.trim();
      roleRaw = paren[2]!.trim();
    } else if (comma >= 0) {
      name = header.slice(0, comma).trim();
      roleRaw = header.slice(comma + 1).trim();
    } else {
      name = header.trim();
      roleRaw = null;
    }
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

  for (let i = 0; i < cleaned.length; i++) {
    const cur = cleaned[i]!;
    const next = cleaned[i + 1];
    const body = text.slice(cur.end, next ? next.index : text.length).trim();
    if (body.length < 8) continue;
    // Split long monologues into ~sentence paragraphs for karaoke granularity
    const sentences = body
      .split(/(?<=[.!?])\s+(?=[A-Z“"'])/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    const chunks =
      sentences.length <= 1
        ? [body]
        : groupSentences(sentences, 420);
    const sid = speakerIdFor(cur.header);
    for (const chunk of chunks) {
      paragraphs.push({ speakerId: sid, text: chunk });
    }
  }

  return { speakers, paragraphs };
}

function groupSentences(sentences: string[], maxLen: number): string[] {
  const out: string[] = [];
  let buf = "";
  for (const s of sentences) {
    if (!buf) {
      buf = s;
      continue;
    }
    if (buf.length + 1 + s.length > maxLen) {
      out.push(buf);
      buf = s;
    } else {
      buf = `${buf} ${s}`;
    }
  }
  if (buf) out.push(buf);
  return out;
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
    const words = wordsFromDuration(p.text, startSec, endSec);
    return {
      ...p,
      startSec: Math.round(startSec * 100) / 100,
      endSec: Math.round(endSec * 100) / 100,
      words,
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

function downloadPdf(url: string, dest: string) {
  mkdirSync(path.dirname(dest), { recursive: true });
  const curl = spawnSync(
    "curl",
    ["-L", "--fail", "-A", "Mozilla/5.0", "-o", dest, url],
    { encoding: "utf8" },
  );
  if (curl.status !== 0) throw new Error(`pdf download failed: ${curl.stderr?.slice(0, 300)}`);
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
  if (!existsSync(destMp3)) {
    throw new Error(`yt-dlp did not produce ${destMp3}`);
  }
}

async function main() {
  const only = argList("only");
  const force = hasFlag("force");
  const skipAudio = hasFlag("skip-audio");
  const quarters = only ? QUARTERS.filter((q) => only.includes(q.slug)) : QUARTERS;

  const fixtureDir = path.join("lib/market/fixtures");
  const audioDir = path.join("public/earnings-audio/GOOGL");
  const pdfDir = path.join("tmp/googl-ir");
  mkdirSync(fixtureDir, { recursive: true });
  mkdirSync(audioDir, { recursive: true });
  mkdirSync(pdfDir, { recursive: true });

  const results: { slug: string; status: string; pdf?: string; youtube?: string }[] = [];
  const index: unknown[] = [];

  for (const q of quarters) {
    console.log(`\n=== ${q.fiscalPeriodLabel} (${q.slug}) ===`);
    const fixturePath = path.join(fixtureDir, `googl-${q.slug}-transcript.json`);
    const mp3Path = path.join(audioDir, `${q.slug}.mp3`);
    const pdfPath = path.join(pdfDir, `${q.slug}.pdf`);

    console.log("pdf", q.pdfUrl);
    console.log("youtube", q.youtubeUrl);

    if (!existsSync(pdfPath) || force) {
      console.log("downloading PDF…");
      try {
        downloadPdf(q.pdfUrl, pdfPath);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        results.push({ slug: q.slug, status: `fail pdf: ${msg}`, pdf: q.pdfUrl });
        continue;
      }
    }

    let raw: string;
    try {
      raw = extractPdfText(pdfPath);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      results.push({ slug: q.slug, status: `fail extract: ${msg}` });
      continue;
    }
    writeFileSync(path.join(pdfDir, `${q.slug}.txt`), raw + "\n");
    const parsed = parseAlphabetTranscript(raw);
    console.log("speakers", parsed.speakers.length, "paras", parsed.paragraphs.length);
    if (parsed.paragraphs.length < 5) {
      results.push({ slug: q.slug, status: "fail: too few paragraphs from PDF" });
      continue;
    }

    if (!skipAudio && (!existsSync(mp3Path) || force)) {
      console.log("downloading YouTube audio…");
      try {
        downloadYoutubeMp3(q.youtubeUrl, mp3Path);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error("audio fail", msg);
        results.push({
          slug: q.slug,
          status: `fail audio: ${msg}`,
          pdf: q.pdfUrl,
          youtube: q.youtubeUrl,
        });
        continue;
      }
    }

    const durationSec = existsSync(mp3Path) ? probeDurationSec(mp3Path) : null;
    let paragraphs = parsed.paragraphs;
    let audioSync: string | undefined;
    if (durationSec != null) {
      paragraphs = applyProportionalTimings(paragraphs, durationSec);
      audioSync = "ir-pdf-proportional";
    }

    const fixture = {
      ticker: "GOOGL" as const,
      companyName: "Alphabet",
      fiscalPeriodLabel: q.fiscalPeriodLabel,
      eventDateYmd: q.eventDateYmd,
      eventTitle: `${q.fiscalPeriodLabel} earnings call`,
      sourceUrl: q.pdfUrl,
      audioUrl: existsSync(mp3Path) ? `/earnings-audio/GOOGL/${q.slug}.mp3` : undefined,
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
      fixtureFile: `googl-${q.slug}-transcript.json`,
      audioFile: `${q.slug}.mp3`,
      sourceUrl: q.pdfUrl,
      eventUrl: q.eventUrl,
      youtubeUrl: q.youtubeUrl,
    });

    results.push({
      slug: q.slug,
      status: "ok",
      pdf: q.pdfUrl,
      youtube: q.youtubeUrl,
    });
  }

  writeFileSync(path.join(fixtureDir, "googl-transcript-index.json"), JSON.stringify(index, null, 2) + "\n");
  writeFileSync("tmp/googl-ir-import-status.json", JSON.stringify({ results }, null, 2) + "\n");
  console.log("\nSummary");
  console.table(results.map((r) => ({ slug: r.slug, status: r.status })));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
