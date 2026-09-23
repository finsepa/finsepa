# Earnings call audio (AAPL)

**Policy:** first-party capture (Apple Podcasts / Art19), same method as Quartr — see `docs/earnings-transcript-audio.md`.

| Quarter | MP3 | Source |
|---------|-----|--------|
| Q3 2026 | `q3-2026.mp3` | bootstrap: stockanalysis / Quartr (Apple window closed) |
| Q2 2026 | `q2-2026.mp3` | bootstrap: stockanalysis / Quartr |
| Q1 2026 | `q1-2026.mp3` | bootstrap: stockanalysis / Quartr |
| Q4 2025 | `q4-2025.mp3` | bootstrap: stockanalysis / Quartr |
| Q3 2025 | `q3-2025.mp3` | bootstrap: stockanalysis / Quartr |
| Q2 2025 | `q2-2025.mp3` | bootstrap: stockanalysis / Quartr |

```bash
# Preferred going forward — run within ~2 weeks of the call:
npx tsx scripts/aapl-capture-earnings-audio.ts
npx tsx scripts/aapl-capture-earnings-audio.ts --list

# Karaoke align after fixture exists:
npx tsx --env-file=.env.local scripts/aapl-align-all-earnings-audio.ts

# Bootstrap only (historical / missed window — not first-party):
npx tsx scripts/aapl-import-earnings-transcripts.ts
```

Apple does not publish a lasting transcript PDF archive. Official audio (IR stream + Podcasts) is kept ~2 weeks; after that the Art19 feed usually shows only a PSA stub.
