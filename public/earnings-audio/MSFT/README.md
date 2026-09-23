# Earnings call audio (MSFT)

**Policy:** first-party Microsoft IR — see `docs/earnings-transcript-audio.md`.

| Quarter | MP3 | Source |
|---------|-----|--------|
| Q4 2026 | `q4-2026.mp3` | Microsoft Medius webcast |
| Q3 2026 | `q3-2026.mp3` | Microsoft Medius webcast |
| Q2 2026 | `q2-2026.mp3` | Microsoft Medius webcast |
| Q1 2026 | `q1-2026.mp3` | Microsoft Medius webcast |
| Q4 2025 | `q4-2025.mp3` | Microsoft Medius webcast |
| Q3 2025 | `q3-2025.mp3` | YouTube fallback (Medius expired ~1yr) |

Transcripts: Microsoft IR DOCX via `cdn-dynmedia` / `aka.ms/transcriptfy…`.

```bash
npx tsx scripts/msft-import-ir-earnings.ts
npx tsx scripts/msft-import-ir-earnings.ts --only=q4-2026,q3-2026
npx tsx scripts/msft-import-ir-earnings.ts --skip-audio
```
