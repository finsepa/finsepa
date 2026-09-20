# Earnings call audio (AAPL)

Archived Quartr/stockanalysis webcast audio for the transcript modal.

| Quarter | MP3 | Source |
|---------|-----|--------|
| Q3 2026 | `q3-2026.mp3` | stockanalysis / Quartr |
| Q2 2026 | `q2-2026.mp3` | stockanalysis / Quartr |
| Q1 2026 | `q1-2026.mp3` | stockanalysis / Quartr |
| Q4 2025 | `q4-2025.mp3` | stockanalysis / Quartr |
| Q3 2025 | `q3-2025.mp3` | stockanalysis / Quartr |
| Q2 2025 | `q2-2025.mp3` | stockanalysis / Quartr |

```bash
npx tsx scripts/aapl-import-earnings-transcripts.ts
npx tsx --env-file=.env.local scripts/aapl-align-all-earnings-audio.ts
```

Note: Apple’s own IR stream is only kept ~2 weeks; older calls are imported from stockanalysis.
