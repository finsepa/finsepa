/**
 * GOOGL earnings call transcripts — speaker-segmented from Alphabet IR PDFs.
 * Audio: official YouTube webcasts. Refresh: npx tsx scripts/googl-import-ir-earnings.ts --force
 */

import q1_2025 from "@/lib/market/fixtures/googl-q1-2025-transcript.json";
import q2_2025 from "@/lib/market/fixtures/googl-q2-2025-transcript.json";
import q3_2025 from "@/lib/market/fixtures/googl-q3-2025-transcript.json";
import q4_2025 from "@/lib/market/fixtures/googl-q4-2025-transcript.json";
import q1_2026 from "@/lib/market/fixtures/googl-q1-2026-transcript.json";
import q2_2026 from "@/lib/market/fixtures/googl-q2-2026-transcript.json";

import type { EarningsTranscript } from "@/lib/market/earnings-transcript-types";

/** All local GOOGL transcript fixtures (newest first). */
export const GOOGL_EARNINGS_TRANSCRIPTS: readonly EarningsTranscript[] = [
  q2_2026,
  q1_2026,
  q4_2025,
  q3_2025,
  q2_2025,
  q1_2025,
] as EarningsTranscript[];
