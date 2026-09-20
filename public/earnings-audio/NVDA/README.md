# Earnings call audio (NVDA)

Archived IR webcast files for the transcript modal (play + click-to-seek + word sync).

## Status

| Quarter | MP3 | Sync | Duration | IR webcast |
|---------|-----|------|----------|------------|
| Q2 2027 | `q2-2027.mp3` | whisper-words | ~59.5 min | https://events.q4inc.com/attendee/842602961 |
| Q1 2027 | `q1-2027.mp3` | whisper-words | ~59.8 min | https://events.q4inc.com/attendee/345403167 |
| Q4 2026 | `q4-2026.mp3` | whisper-words | ~66.6 min | https://events.q4inc.com/attendee/412427890 |
| Q3 2026 | `q3-2026.mp3` | whisper-words | ~64.4 min | https://events.q4inc.com/attendee/615721276 |
| Q2 2026 | `q2-2026.mp3` | whisper-words | ~59.8 min | https://events.q4inc.com/attendee/991689799 |
| Q1 2026 | `q1-2026.mp3` | whisper-words | ~62.6 min | https://events.q4inc.com/attendee/988346217 |

## Capture / re-align

```bash
# Guest-register + download all missing MP3s from Q4 IR
npx tsx scripts/nvda-capture-earnings-audio.ts
npx tsx scripts/nvda-capture-earnings-audio.ts --only=q1-2027 --force

# Whisper word-align every quarter that has an MP3
npx tsx --env-file=.env.local scripts/nvda-align-all-earnings-audio.ts
```
