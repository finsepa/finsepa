# Earnings call audio (NVDA)

Archived IR webcast files for the transcript modal (play + click-to-seek).

## Q2 FY2027

- **File:** `q2-2027.mp3` (~59.5 min, from Q4 IR replay)
- **Fixture:** `lib/market/fixtures/nvda-q2-2027-transcript.json` (`audioSync: whisper`)

Re-align after replacing the MP3:

```bash
# Whisper API limit is 25MB — use a compressed copy for align if needed
ffmpeg -y -i public/earnings-audio/NVDA/q2-2027.mp3 -ac 1 -b:a 48k /tmp/nvda-q2-whisper.mp3
npx tsx --env-file=.env.local scripts/nvda-align-earnings-audio.ts \
  --audio=/tmp/nvda-q2-whisper.mp3 \
  --quarter=Q2-2027
# restore stereo playback if the script overwrote it
```
