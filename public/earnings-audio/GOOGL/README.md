# Earnings call audio (GOOGL)

Archived **Alphabet IR** webcast audio for the transcript modal.

| Quarter | MP3 | Transcript | Audio |
|---------|-----|------------|-------|
| Q2 2026 | `q2-2026.mp3` | Alphabet IR PDF (q4cdn) | Official YouTube webcast |
| Q1 2026 | `q1-2026.mp3` | Alphabet IR PDF (q4cdn) | Official YouTube webcast |
| Q4 2025 | `q4-2025.mp3` | Alphabet IR PDF (q4cdn) | Official YouTube webcast |
| Q3 2025 | `q3-2025.mp3` | Alphabet IR PDF (q4cdn) | Official YouTube webcast |
| Q2 2025 | `q2-2025.mp3` | Alphabet IR PDF (q4cdn) | Official YouTube webcast |
| Q1 2025 | `q1-2025.mp3` | Alphabet IR PDF (q4cdn) | Official YouTube webcast |

```bash
# Refresh from Alphabet IR PDFs + YouTube
npx tsx scripts/googl-import-ir-earnings.ts --force

# Optional Whisper word-align (needs OpenAI credits)
npx tsx --env-file=.env.local scripts/googl-align-all-earnings-audio.ts
```

Sources: [abc.xyz/investor/earnings](https://abc.xyz/investor/earnings/) event pages → PDF on `s206.q4cdn.com` + YouTube webcast.
