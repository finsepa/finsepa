/**
 * Align NVDA transcript cards to archived webcast audio via OpenAI Whisper.
 *
 * Requests word-level timestamps (Quartr-style karaoke) plus segment openings
 * for paragraph boundaries.
 *
 *   npx tsx --env-file=.env.local scripts/nvda-align-earnings-audio.ts \
 *     --audio=/tmp/nvda-q2-2027-whisper.mp3 \
 *     --quarter=Q2-2027 \
 *     --no-copy \
 *     --refresh
 *
 * Whisper HTTP limit is 25MB — compress long calls first (mono 48kbps).
 * Word+segment JSON is cached under tmp/nvda-{slug}-whisper-words.json.
 */

import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { File } from "node:buffer";

type TimedWord = { text: string; startSec: number; endSec: number };
type Para = {
  speakerId: number;
  text: string;
  startSec?: number;
  endSec?: number;
  words?: TimedWord[];
};
type Fixture = {
  fiscalPeriodLabel: string;
  audioUrl?: string;
  durationSec?: number;
  audioSync?: string;
  paragraphs: Para[];
  [k: string]: unknown;
};

type WhisperSeg = { start: number; end: number; text: string };
type WhisperWord = { start: number; end: number; word: string };

function arg(name: string): string | null {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : null;
}

function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

function scrub(s: string): string {
  return s
    .replace(/\(\d{1,2}:\d{2}(?::\d{2})?\)/g, " ")
    .replace(/\[ph\]/gi, " ")
    .replace(/\[Operator Instructions\]/gi, " ");
}

function normalize(s: string): string {
  return scrub(s)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokens(s: string): string[] {
  return normalize(s)
    .split(" ")
    .filter((t) => t.length > 1);
}

function normWord(w: string): string {
  return normalize(w).replace(/\s+/g, "");
}

function prefixScore(needle: string[], hay: string[]): number {
  if (needle.length === 0 || hay.length === 0) return 0;
  let matched = 0;
  for (let i = 0; i < needle.length && i < hay.length; i++) {
    const a = needle[i]!;
    const b = hay[i]!;
    if (a === b || a.startsWith(b) || b.startsWith(a)) matched++;
    else break;
  }
  return matched / needle.length;
}

function bagScore(needle: string[], hay: string[]): number {
  if (needle.length === 0 || hay.length === 0) return 0;
  const set = new Set(hay);
  let hit = 0;
  for (const t of needle) if (set.has(t)) hit++;
  return hit / needle.length;
}

function findOpeningInWords(words: WhisperWord[], fromIdx: number, opening: string[]): number {
  if (opening.length === 0 || words.length === 0) return fromIdx;
  const searchEnd = Math.min(words.length, fromIdx + 400);
  let best = { i: fromIdx, score: -1 };

  for (let i = fromIdx; i < searchEnd; i++) {
    const hay: string[] = [];
    for (let j = i; j < Math.min(words.length, i + opening.length + 4); j++) {
      const t = normWord(words[j]!.word);
      if (t) hay.push(t);
    }
    const pref = prefixScore(opening, hay);
    const bag = bagScore(opening.slice(0, 6), hay);
    const score = pref * 0.8 + bag * 0.2;
    if (score > best.score) best = { i, score };
    if (pref >= 0.7) return i;
  }
  return best.i;
}

function findOpeningSeg(segs: WhisperSeg[], fromIdx: number, opening: string[]): number {
  if (opening.length === 0) return fromIdx;
  const searchEnd = Math.min(segs.length, fromIdx + 48);
  let best = { i: fromIdx, score: -1 };

  for (let i = fromIdx; i < searchEnd; i++) {
    let combined = "";
    for (let j = i; j < Math.min(segs.length, i + 8); j++) {
      combined += " " + segs[j]!.text;
      const hay = tokens(combined);
      const pref = prefixScore(opening, hay);
      const bag = bagScore(opening.slice(0, 6), hay);
      const score = pref * 0.75 + bag * 0.25;
      if (score > best.score) best = { i, score };
      if (pref >= 0.65) return i;
    }
  }
  return best.i;
}

/** Split display text into speech tokens (no whitespace). */
function displaySpeechTokens(text: string): string[] {
  return text.split(/\s+/).filter((t) => t.length > 0);
}

/**
 * Map IR display tokens onto Whisper words by greedy normalized matching
 * (falls back to index proportion for unmatched tails).
 */
function mapDisplayWords(
  displayText: string,
  whisperSlice: WhisperWord[],
  startSec: number,
  endSec: number,
): TimedWord[] {
  const display = displaySpeechTokens(displayText);
  if (display.length === 0) return [];

  if (whisperSlice.length === 0) {
    const span = Math.max(0.05, endSec - startSec);
    return display.map((text, i) => {
      const t0 = startSec + (i / display.length) * span;
      const t1 = startSec + ((i + 1) / display.length) * span;
      return {
        text,
        startSec: Math.round(t0 * 100) / 100,
        endSec: Math.round(t1 * 100) / 100,
      };
    });
  }

  const wNorm = whisperSlice.map((w) => normWord(w.word));
  const assigned: (number | null)[] = display.map(() => null);
  let wIdx = 0;

  for (let i = 0; i < display.length; i++) {
    const needle = normWord(display[i]!);
    if (!needle) continue;
    let found = -1;
    const searchEnd = Math.min(wNorm.length, wIdx + 12);
    for (let j = wIdx; j < searchEnd; j++) {
      const hay = wNorm[j]!;
      if (!hay) continue;
      if (hay === needle || hay.startsWith(needle) || needle.startsWith(hay)) {
        found = j;
        break;
      }
    }
    if (found < 0) {
      // Loose: allow skipping one whisper filler word
      for (let j = wIdx; j < Math.min(wNorm.length, wIdx + 4); j++) {
        const hay = wNorm[j]!;
        if (!hay || hay.length < 2) continue;
        if (hay === needle || hay.startsWith(needle.slice(0, 4)) || needle.startsWith(hay.slice(0, 4))) {
          found = j;
          break;
        }
      }
    }
    if (found >= 0) {
      assigned[i] = found;
      wIdx = found + 1;
    }
  }

  // Fill gaps by linear interpolation between matched anchors
  let lastMatched = -1;
  for (let i = 0; i < display.length; i++) {
    if (assigned[i] != null) {
      lastMatched = i;
      continue;
    }
    let nextMatched = -1;
    for (let k = i + 1; k < display.length; k++) {
      if (assigned[k] != null) {
        nextMatched = k;
        break;
      }
    }
    if (lastMatched >= 0 && nextMatched >= 0) {
      const a = assigned[lastMatched]!;
      const b = assigned[nextMatched]!;
      const t = (i - lastMatched) / (nextMatched - lastMatched);
      assigned[i] = Math.round(a + t * (b - a));
    } else if (lastMatched >= 0) {
      assigned[i] = Math.min(wNorm.length - 1, assigned[lastMatched]! + (i - lastMatched));
    } else if (nextMatched >= 0) {
      assigned[i] = Math.max(0, assigned[nextMatched]! - (nextMatched - i));
    } else {
      assigned[i] = Math.min(
        wNorm.length - 1,
        Math.round((i / Math.max(1, display.length - 1)) * (wNorm.length - 1)),
      );
    }
  }

  return display.map((text, i) => {
    const j = Math.min(wNorm.length - 1, Math.max(0, assigned[i] ?? 0));
    const w = whisperSlice[j]!;
    const next = whisperSlice[Math.min(wNorm.length - 1, j + 1)]!;
    return {
      text,
      startSec: Math.round(w.start * 100) / 100,
      endSec: Math.round((j < wNorm.length - 1 ? next.start : w.end) * 100) / 100,
    };
  });
}

function alignWithWords(
  paras: Para[],
  segs: WhisperSeg[],
  words: WhisperWord[],
  durationSec: number,
): { startSec: number; endSec: number; words: TimedWord[] }[] {
  const useWords = words.length > 0;
  const starts: number[] = [];
  const startWordIdx: number[] = [];
  let cursor = 0;
  let wCursor = 0;

  for (const para of paras) {
    const opening = tokens(para.text).slice(0, 12);
    if (useWords) {
      const hit = findOpeningInWords(words, wCursor, opening);
      starts.push(words[hit]?.start ?? 0);
      startWordIdx.push(hit);
      wCursor = Math.min(words.length - 1, Math.max(wCursor + 1, hit + 1));
    } else {
      const hit = findOpeningSeg(segs, cursor, opening);
      starts.push(segs[hit]?.start ?? 0);
      startWordIdx.push(0);
      cursor = Math.min(segs.length - 1, Math.max(cursor + 1, hit + 1));
    }
  }

  for (let i = 1; i < starts.length; i++) {
    if (starts[i]! < starts[i - 1]!) {
      starts[i] = starts[i - 1]!;
      startWordIdx[i] = Math.max(startWordIdx[i]!, startWordIdx[i - 1]!);
    }
  }

  const lastEnd =
    useWords
      ? (words[words.length - 1]?.end ?? durationSec)
      : (segs[segs.length - 1]?.end ?? durationSec);

  return starts.map((startSec, i) => {
    const nextStart = starts[i + 1];
    const endSec =
      nextStart != null && nextStart > startSec ? nextStart : Math.max(startSec + 1, lastEnd);
    const w0 = startWordIdx[i] ?? 0;
    const w1 = i + 1 < startWordIdx.length ? startWordIdx[i + 1]! : words.length;
    const slice = useWords ? words.slice(w0, Math.max(w0 + 1, w1)) : [];
    const mapped = mapDisplayWords(paras[i]!.text, slice, startSec, endSec);
    return {
      startSec: Math.round(startSec * 100) / 100,
      endSec: Math.round(endSec * 100) / 100,
      words: mapped,
    };
  });
}

async function whisperVerbose(
  audioPath: string,
  apiKey: string,
  cachePath: string,
): Promise<{ duration?: number; segments: WhisperSeg[]; words: WhisperWord[]; text?: string }> {
  if (existsSync(cachePath) && !hasFlag("refresh")) {
    console.log("Using cached Whisper JSON:", cachePath);
    const cached = JSON.parse(readFileSync(cachePath, "utf8")) as {
      duration?: number;
      segments?: WhisperSeg[];
      words?: WhisperWord[];
      text?: string;
    };
    return {
      duration: cached.duration,
      text: cached.text,
      segments: cached.segments ?? [],
      words: cached.words ?? [],
    };
  }

  const buf = readFileSync(audioPath);
  if (buf.byteLength > 24.5 * 1024 * 1024) {
    throw new Error(
      `Audio is ${(buf.byteLength / 1024 / 1024).toFixed(1)}MB — Whisper limit is 25MB. Compress first (mono 48kbps).`,
    );
  }
  const name = path.basename(audioPath);
  const type = name.endsWith(".m4a") ? "audio/mp4" : "audio/mpeg";
  const form = new FormData();
  form.append("file", new File([buf], name, { type }));
  form.append("model", "whisper-1");
  form.append("response_format", "verbose_json");
  form.append("timestamp_granularities[]", "word");
  form.append("timestamp_granularities[]", "segment");

  console.log("Transcribing with Whisper (words + segments)…", audioPath);
  const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Whisper ${res.status}: ${body.slice(0, 500)}`);
  }
  const json = (await res.json()) as {
    duration?: number;
    text?: string;
    segments?: Array<{ start?: number; end?: number; text?: string }>;
    words?: Array<{ start?: number; end?: number; word?: string }>;
  };
  const out = {
    duration: json.duration,
    text: json.text,
    segments: (json.segments ?? []).map((s) => ({
      start: Number(s.start) || 0,
      end: Number(s.end) || 0,
      text: String(s.text ?? ""),
    })),
    words: (json.words ?? []).map((w) => ({
      start: Number(w.start) || 0,
      end: Number(w.end) || 0,
      word: String(w.word ?? ""),
    })),
  };
  mkdirSync(path.dirname(cachePath), { recursive: true });
  writeFileSync(cachePath, JSON.stringify(out, null, 2) + "\n");
  console.log("Cached Whisper →", cachePath, `(${out.words.length} words, ${out.segments.length} segs)`);
  return out;
}

async function main() {
  const audioPath = arg("audio");
  const quarter = (arg("quarter") ?? "Q2-2027").toUpperCase();
  if (!audioPath) {
    console.error("Usage: --audio=path/to/call.mp3 [--quarter=Q2-2027] [--no-copy] [--refresh]");
    process.exit(1);
  }
  if (!existsSync(audioPath)) {
    console.error("Audio not found:", audioPath);
    process.exit(1);
  }
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    console.error("OPENAI_API_KEY missing");
    process.exit(1);
  }

  const slug = quarter.toLowerCase().replace(/\s+/g, "-");
  const fixturePath = path.join("lib/market/fixtures", `nvda-${slug}-transcript.json`);
  if (!existsSync(fixturePath)) {
    console.error("Fixture not found:", fixturePath);
    process.exit(1);
  }

  const fixture = JSON.parse(readFileSync(fixturePath, "utf8")) as Fixture;
  const cachePath = path.join("tmp", `nvda-${slug}-whisper-words.json`);
  const tr = await whisperVerbose(audioPath, apiKey, cachePath);
  if (tr.segments.length === 0 && tr.words.length === 0) {
    console.error("No Whisper segments/words returned");
    process.exit(1);
  }

  const duration = tr.duration ?? tr.words[tr.words.length - 1]?.end ?? tr.segments[tr.segments.length - 1]?.end ?? 0;
  const aligned = alignWithWords(fixture.paragraphs, tr.segments, tr.words, duration);

  fixture.paragraphs = fixture.paragraphs.map((p, i) => ({
    speakerId: p.speakerId,
    text: p.text,
    startSec: aligned[i]!.startSec,
    endSec: aligned[i]!.endSec,
    words: aligned[i]!.words,
  }));
  fixture.durationSec = Math.round(duration * 100) / 100;
  fixture.audioSync = tr.words.length > 0 ? "whisper-words" : "whisper-contiguous";
  fixture.audioUrl = `/earnings-audio/NVDA/${slug}.mp3`;

  writeFileSync(fixturePath, JSON.stringify(fixture, null, 2) + "\n");
  console.log("Wrote", fixturePath);

  if (!hasFlag("no-copy")) {
    const publicDir = path.join("public/earnings-audio/NVDA");
    mkdirSync(publicDir, { recursive: true });
    const publicMp3 = path.join(publicDir, `${slug}.mp3`);
    copyFileSync(audioPath, publicMp3);
    console.log("Copied audio →", publicMp3);
  } else {
    console.log("Skipped audio copy (--no-copy)");
  }

  const wordCount = fixture.paragraphs.reduce((n, p) => n + (p.words?.length ?? 0), 0);
  console.log("durationSec", fixture.durationSec, "audioSync", fixture.audioSync, "words", wordCount);
  console.table(
    fixture.paragraphs.slice(0, 5).map((p, i) => ({
      i,
      start: p.startSec,
      end: p.endSec,
      words: p.words?.length ?? 0,
      head: p.text.slice(0, 40),
    })),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
