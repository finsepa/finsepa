/**
 * MSFT earnings call transcripts — speaker-segmented from Microsoft IR DOCX.
 * Audio: official Medius webcast (HLS). Refresh: npx tsx scripts/msft-import-ir-earnings.ts --force
 */

import q3_2025 from "@/lib/market/fixtures/msft-q3-2025-transcript.json";
import q4_2025 from "@/lib/market/fixtures/msft-q4-2025-transcript.json";
import q1_2026 from "@/lib/market/fixtures/msft-q1-2026-transcript.json";
import q2_2026 from "@/lib/market/fixtures/msft-q2-2026-transcript.json";
import q3_2026 from "@/lib/market/fixtures/msft-q3-2026-transcript.json";
import q4_2026 from "@/lib/market/fixtures/msft-q4-2026-transcript.json";

import type { EarningsTranscript } from "@/lib/market/earnings-transcript-types";

/** All local MSFT transcript fixtures (newest first). */
export const MSFT_EARNINGS_TRANSCRIPTS: readonly EarningsTranscript[] = [
  q4_2026,
  q3_2026,
  q2_2026,
  q1_2026,
  q4_2025,
  q3_2025,
] as EarningsTranscript[];
