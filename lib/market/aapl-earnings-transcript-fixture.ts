/**
 * AAPL earnings call transcripts.
 * Going forward: capture Apple Podcasts audio (`aapl-capture-earnings-audio.ts`)
 * then ASR/align — see docs/earnings-transcript-audio.md.
 * Historical fixtures were bootstrapped via stockanalysis when Apple’s ~2-week window had closed.
 */

import q2_2025 from "@/lib/market/fixtures/aapl-q2-2025-transcript.json";
import q3_2025 from "@/lib/market/fixtures/aapl-q3-2025-transcript.json";
import q4_2025 from "@/lib/market/fixtures/aapl-q4-2025-transcript.json";
import q1_2026 from "@/lib/market/fixtures/aapl-q1-2026-transcript.json";
import q2_2026 from "@/lib/market/fixtures/aapl-q2-2026-transcript.json";
import q3_2026 from "@/lib/market/fixtures/aapl-q3-2026-transcript.json";

import type { EarningsTranscript } from "@/lib/market/earnings-transcript-types";

/** All local AAPL transcript fixtures (newest first). */
export const AAPL_EARNINGS_TRANSCRIPTS: readonly EarningsTranscript[] = [
  q3_2026,
  q2_2026,
  q1_2026,
  q4_2025,
  q3_2025,
  q2_2025,
] as EarningsTranscript[];
