/**
 * Align every NVDA quarter that has both a transcript fixture and a local MP3.
 *
 *   npx tsx --env-file=.env.local scripts/nvda-align-all-earnings-audio.ts
 *   npx tsx --env-file=.env.local scripts/nvda-align-all-earnings-audio.ts --refresh
 *
 * Expects: public/earnings-audio/NVDA/{slug}.mp3
 * Writes word timings into lib/market/fixtures/nvda-{slug}-transcript.json
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const QUARTERS = [
  "Q2-2027",
  "Q1-2027",
  "Q4-2026",
  "Q3-2026",
  "Q2-2026",
  "Q1-2026",
] as const;

function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

function main() {
  const refresh = hasFlag("refresh") ? " --refresh" : "";
  const results: { quarter: string; status: string }[] = [];

  for (const quarter of QUARTERS) {
    const slug = quarter.toLowerCase();
    const fixture = path.join("lib/market/fixtures", `nvda-${slug}-transcript.json`);
    const publicMp3 = path.join("public/earnings-audio/NVDA", `${slug}.mp3`);

    if (!existsSync(fixture)) {
      results.push({ quarter, status: "skip (no fixture)" });
      continue;
    }
    if (!existsSync(publicMp3)) {
      results.push({ quarter, status: "skip (no mp3)" });
      continue;
    }

    mkdirSync("/tmp", { recursive: true });
    const whisperMp3 = `/tmp/nvda-${slug}-whisper.mp3`;
    const sizeMb = readFileSync(publicMp3).byteLength / (1024 * 1024);
    let audioForAlign = publicMp3;

    if (sizeMb > 24.5) {
      console.log(`Compressing ${publicMp3} (${sizeMb.toFixed(1)}MB) → ${whisperMp3}`);
      const ff = spawnSync(
        "ffmpeg",
        ["-y", "-i", publicMp3, "-ac", "1", "-ar", "16000", "-b:a", "48k", whisperMp3],
        { encoding: "utf8" },
      );
      if (ff.status !== 0) {
        results.push({ quarter, status: `ffmpeg failed: ${ff.stderr?.slice(0, 200)}` });
        continue;
      }
      audioForAlign = whisperMp3;
    }

    console.log(`\n=== Aligning ${quarter} ===`);
    const cmd = `npx tsx --env-file=.env.local scripts/nvda-align-earnings-audio.ts --audio=${audioForAlign} --quarter=${quarter} --no-copy${refresh}`;
    const run = spawnSync("bash", ["-lc", cmd], { encoding: "utf8", stdio: "inherit" });
    results.push({
      quarter,
      status: run.status === 0 ? "ok" : `failed (exit ${run.status})`,
    });
  }

  const stamp = {
    generatedAt: new Date().toISOString(),
    results,
  };
  mkdirSync("tmp", { recursive: true });
  writeFileSync("tmp/nvda-align-all-status.json", JSON.stringify(stamp, null, 2) + "\n");
  console.log("\nSummary");
  console.table(results);
}

main();
