/**
 * AAPL earnings call transcripts — speaker-segmented from stockanalysis (Quartr audio).
 * Refresh: npx tsx scripts/aapl-import-earnings-transcripts.ts --force
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
