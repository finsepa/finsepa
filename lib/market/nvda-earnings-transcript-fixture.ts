/**
 * NVDA earnings call transcripts — speaker-segmented from NVIDIA IR FactSet PDFs.
 * Available quarters: see `fixtures/nvda-transcript-index.json`.
 */

import q1_2026 from "@/lib/market/fixtures/nvda-q1-2026-transcript.json";
import q1_2027 from "@/lib/market/fixtures/nvda-q1-2027-transcript.json";
import q2_2026 from "@/lib/market/fixtures/nvda-q2-2026-transcript.json";
import q2_2027 from "@/lib/market/fixtures/nvda-q2-2027-transcript.json";
import q3_2026 from "@/lib/market/fixtures/nvda-q3-2026-transcript.json";
import q4_2026 from "@/lib/market/fixtures/nvda-q4-2026-transcript.json";

import type {
  EarningsTranscript,
  NvdaEarningsTranscript,
  NvdaTranscriptParagraph,
  NvdaTranscriptSpeaker,
  NvdaTranscriptWord,
} from "@/lib/market/earnings-transcript-types";

export type {
  NvdaEarningsTranscript,
  NvdaTranscriptParagraph,
  NvdaTranscriptSpeaker,
  NvdaTranscriptWord,
};

/** All local NVDA transcript fixtures (newest first). */
export const NVDA_EARNINGS_TRANSCRIPTS: readonly EarningsTranscript[] = [
  q2_2027,
  q1_2027,
  q4_2026,
  q3_2026,
  q2_2026,
  q1_2026,
] as EarningsTranscript[];

/** @deprecated Prefer `NVDA_EARNINGS_TRANSCRIPTS` — kept for older imports. */
export const NVDA_Q2_FY2027_TRANSCRIPT = q2_2027 as NvdaEarningsTranscript;
