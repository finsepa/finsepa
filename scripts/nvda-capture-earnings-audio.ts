/**
 * Capture NVDA IR webcast replays from Q4 events → public/earnings-audio/NVDA/{slug}.mp3
 *
 *   npx tsx scripts/nvda-capture-earnings-audio.ts
 *   npx tsx scripts/nvda-capture-earnings-audio.ts --only=q1-2027,q4-2026
 *
 * Guest-registers on each events.q4inc.com attendee page, finds videoRecordingLink,
 * downloads the MP4 with session cookies, extracts MP3.
 */

import { existsSync, mkdirSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { chromium } from "playwright";

type Quarter = {
  slug: string;
  attendeeId: string;
  label: string;
};

const QUARTERS: Quarter[] = [
  { slug: "q2-2027", attendeeId: "842602961", label: "Q2 2027" },
  { slug: "q1-2027", attendeeId: "345403167", label: "Q1 2027" },
  { slug: "q4-2026", attendeeId: "412427890", label: "Q4 2026" },
  { slug: "q3-2026", attendeeId: "615721276", label: "Q3 2026" },
  { slug: "q2-2026", attendeeId: "991689799", label: "Q2 2026" },
  { slug: "q1-2026", attendeeId: "988346217", label: "Q1 2026" },
];

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

async function guestRegister(page: import("playwright").Page, emailTag: string, attendeeId: string) {
  // Prefer the guest form URL (skips the account chooser).
  await page.goto(`https://events.q4inc.com/attendee/${attendeeId}/guest`, {
    waitUntil: "domcontentloaded",
    timeout: 60_000,
  });
  await page.waitForTimeout(2000);

  // If still on chooser, click continue
  const continueBtn = page.getByRole("button", { name: /Continue without a Q4 account/i });
  if (await continueBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await continueBtn.click({ force: true });
    await page.waitForTimeout(2000);
  }

  if (await page.locator("video").count()) return "player";

  // Wait for form fields
  await page.waitForSelector("#GuestRegistrationFirstNameInput, #GuestRegistrationEmailInput", {
    timeout: 20000,
  }).catch(() => undefined);

  if (!(await page.locator("#GuestRegistrationEmailInput").count())) {
    const text = await page.locator("body").innerText().catch(() => "");
    return `no-form: ${text.slice(0, 120).replace(/\s+/g, " ")}`;
  }

  await page.evaluate(`(async () => {
    const tag = ${JSON.stringify(emailTag)};
    const setNative = (el, val) => {
      if (!el) return;
      const proto = Object.getPrototypeOf(el);
      const desc = Object.getOwnPropertyDescriptor(proto, "value");
      desc && desc.set && desc.set.call(el, val);
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
    };

    const individual = document.querySelector("#GuestRegistrationInvestorCheckboxInput");
    if (individual && !individual.checked) individual.click();

    setNative(document.querySelector("#GuestRegistrationFirstNameInput"), "Finsepa");
    setNative(document.querySelector("#GuestRegistrationLastNameInput"), "Research");
    setNative(
      document.querySelector("#GuestRegistrationEmailInput"),
      "research+nvda-" + tag + "@finsepa.local",
    );
    setNative(document.querySelector("#GuestRegistrationRoleFieldInput"), "Analyst");
    const company = document.querySelector("#GuestRegistrationInstitutionLookupInput");
    if (company) setNative(company, "");

    document
      .querySelectorAll('[class*="dropdown"], [class*="listbox"], [role="listbox"]')
      .forEach((el) => {
        try { el.style.display = "none"; } catch (e) {}
      });

    const btn = Array.from(document.querySelectorAll("button")).find((b) =>
      /Register for this Event/i.test(b.textContent || ""),
    );
    if (btn) btn.click();
  })()`);

  for (let i = 0; i < 40; i++) {
    await page.waitForTimeout(1000);
    if (await page.locator("video").count()) return "player";
    const text = await page.locator("body").innerText().catch(() => "");
    if (/Recorded|Chapters|Prepared Remarks/i.test(text) && !/Guest Registration/i.test(text)) {
      return "player-ish";
    }
  }
  return "timeout";
}

async function findRecordingUrl(page: import("playwright").Page): Promise<string | null> {
  await page.evaluate(`(() => {
    const v = document.querySelector("video");
    if (v && v.play) v.play().catch(() => {});
    // Click any Play control if present
    const btn = Array.from(document.querySelectorAll("button, [role=button]")).find((b) =>
      /play/i.test(b.getAttribute("aria-label") || b.textContent || ""),
    );
    if (btn) btn.click();
  })()`);

  for (let i = 0; i < 15; i++) {
    await page.waitForTimeout(1500);
    const url = await page.evaluate(`(() => {
      const fromVideo = (document.querySelector("video") || {}).currentSrc || "";
      if (/videoRecordingLink|\\.mp4|m3u8/i.test(fromVideo) && !/\\.vtt$/i.test(fromVideo)) return fromVideo;
      const fromPerf = performance
        .getEntriesByType("resource")
        .map((e) => e.name)
        .find((u) => /videoRecordingLink|companyAssets\\/.*\\/videos\\//i.test(u) && !/\\.vtt$/i.test(u));
      if (fromPerf) return fromPerf;
      const fromDom = Array.from(document.querySelectorAll("video, source, a, [src], [href]"))
        .map((el) => el.currentSrc || el.href || el.src)
        .find((u) => u && /videoRecordingLink|companyAssets\\/.*\\/videos\\//i.test(u) && !/\\.vtt$/i.test(u));
      return fromDom || null;
    })()`);
    if (typeof url === "string" && url) return url;
  }
  return null;
}

async function downloadWithContext(
  page: import("playwright").Page,
  url: string,
  dest: string,
): Promise<void> {
  const res = await page.context().request.get(url, {
    headers: {
      Referer: page.url(),
      Origin: "https://events.q4inc.com",
    },
    timeout: 600_000,
  });
  if (!res.ok()) {
    throw new Error(`download ${res.status()} for ${url}`);
  }
  const buf = Buffer.from(await res.body());
  writeFileSync(dest, buf);
}

function extractMp3(mp4: string, mp3: string) {
  const r = spawnSync(
    "ffmpeg",
    ["-y", "-i", mp4, "-vn", "-acodec", "libmp3lame", "-q:a", "4", mp3],
    { encoding: "utf8" },
  );
  if (r.status !== 0) {
    throw new Error(`ffmpeg failed: ${r.stderr?.slice(0, 400)}`);
  }
}

async function main() {
  const only = argList("only");
  const force = hasFlag("force");
  const quarters = only
    ? QUARTERS.filter((q) => only.includes(q.slug))
    : QUARTERS.filter((q) => q.slug !== "q2-2027" || force);

  const outDir = path.join("public/earnings-audio/NVDA");
  const tmpDir = "/tmp/nvda-webcasts";
  mkdirSync(outDir, { recursive: true });
  mkdirSync(tmpDir, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
  });
  const results: { slug: string; status: string; url?: string }[] = [];

  try {
    for (const q of quarters) {
      const mp3 = path.join(outDir, `${q.slug}.mp3`);
      if (existsSync(mp3) && !force) {
        results.push({ slug: q.slug, status: "skip (exists)" });
        console.log(`SKIP ${q.slug} — already have ${mp3}`);
        continue;
      }

      console.log(`\n=== ${q.label} (${q.slug}) attendee ${q.attendeeId} ===`);
        const page = await context.newPage();
      try {
        const reg = await guestRegister(page, q.slug, q.attendeeId);
        console.log("register →", reg, page.url());

        const mediaUrl = await findRecordingUrl(page);
        if (!mediaUrl) {
          const body = (await page.locator("body").innerText().catch(() => "")).slice(0, 400);
          results.push({ slug: q.slug, status: `no media (${reg}): ${body.replace(/\s+/g, " ")}` });
          console.log("NO MEDIA", body.slice(0, 200));
          continue;
        }
        console.log("media", mediaUrl);

        const mp4 = path.join(tmpDir, `${q.slug}.mp4`);
        console.log("downloading…");
        await downloadWithContext(page, mediaUrl, mp4);
        console.log("saved", mp4, `${(statSync(mp4).size / 1e6).toFixed(1)}MB`);
        extractMp3(mp4, mp3);
        console.log("mp3", mp3);
        results.push({ slug: q.slug, status: "ok", url: mediaUrl });
        try {
          unlinkSync(mp4);
        } catch {
          /* ignore */
        }
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
  writeFileSync("tmp/nvda-capture-status.json", JSON.stringify({ results }, null, 2) + "\n");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
