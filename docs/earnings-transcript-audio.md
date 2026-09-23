# Earnings transcript + audio (first-party capture)

**Rule:** Copy Quartr’s *method*, not Quartr’s files. Capture company-published audio (and official transcript PDFs when they exist), store them in Finsepa, generate/align transcripts with our tooling. Over time this becomes our own archive we can productize.

Do **not** treat Stock Analysis / Quartr embeds as the long-term source of truth. Aggregators are bootstrap only when the issuer window already closed.

## Quartr’s method (what we replicate)

1. **Live / early replay** — pull the issuer’s webcast or official podcast while it is up.
2. **Own the recording** — keep MP3 (or equivalent) under `public/earnings-audio/{TICKER}/`.
3. **Transcript** — prefer issuer PDF (NVDA IR, Alphabet IR). If none exists (Apple), ASR from *our* audio (Whisper) + speaker structure.
4. **Align** — word timings for karaoke (`whisper-words`).
5. **Never depend on the issuer keeping replay forever** — Apple’s FAQ: ~2 weeks on Podcasts / IR stream.

## Per-issuer reality

| Ticker | Official transcript PDF | Official audio archive | Finsepa path |
|--------|-------------------------|------------------------|--------------|
| **NVDA** | IR / Q4 PDFs | Q4 webcast (durable) | IR import + Q4 capture |
| **GOOGL** | abc.xyz IR PDFs | YouTube (durable) | IR import + YouTube audio |
| **MSFT** | IR DOCX (`aka.ms/transcriptfy…`) | Medius webcast ~1 year | IR DOCX + Medius HLS (`msft-import-ir-earnings.ts`) |
| **AAPL** | **None** | IR stream + [Apple Podcasts](https://podcasts.apple.com/us/podcast/apple-quarterly-earnings-call/id74942331) **~2 weeks only** | Capture Podcasts/Art19 RSS **within window**; ASR later |

## Apple (AAPL) specifically

```bash
# During the ~2-week post-call window (RSS will list the real episode):
npx tsx scripts/aapl-capture-earnings-audio.ts
npx tsx scripts/aapl-capture-earnings-audio.ts --only=q4-2026

# After fixture text exists, align karaoke:
npx tsx --env-file=.env.local scripts/aapl-align-all-earnings-audio.ts
```

- Feed: `https://rss.art19.com/apple-quarterly-earnings-call`
- Outside the window the feed often shows only a short PSA — that means we **missed** capture; do not fall back to scraping Quartr for “first-party.”
- Historical AAPL fixtures already in-repo were bootstrapped from stockanalysis when Apple’s window had closed. Going forward, new quarters should enter via `aapl-capture-earnings-audio.ts` (and Whisper ASR), not aggregators.

## Scope (same discipline as IR vault)

| Layer | What we do |
|-------|------------|
| **History** | Keep curated large names we already own; do not pretend we can re-pull Apple audio from 2024 IR. |
| **Going forward** | Capture job each earnings week for tickers with short-lived audio (AAPL first). |
| **Sell later** | Own files + our transcripts = licensable dataset; redistributing Quartr is not. |

## Attribution in fixtures / README

- Prefer `sourceUrls` pointing at **issuer** IR / Podcasts / YouTube / Q4.
- If a quarter was bootstrap-only, leave that honest in `public/earnings-audio/{TICKER}/README.md` until replaced by a first-party capture (usually only possible for the next call onward).
