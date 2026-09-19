/**
 * NVDA earnings call transcripts — speaker-segmented from NVIDIA IR FactSet PDFs.
 * Available quarters: see `fixtures/nvda-transcript-index.json` (IR publishes Transcript links for FY2026+).
 */

import q1_2026 from "@/lib/market/fixtures/nvda-q1-2026-transcript.json";
import q1_2027 from "@/lib/market/fixtures/nvda-q1-2027-transcript.json";
import q2_2026 from "@/lib/market/fixtures/nvda-q2-2026-transcript.json";
import q2_2027 from "@/lib/market/fixtures/nvda-q2-2027-transcript.json";
import q3_2026 from "@/lib/market/fixtures/nvda-q3-2026-transcript.json";
import q4_2026 from "@/lib/market/fixtures/nvda-q4-2026-transcript.json";

export type NvdaTranscriptSpeaker = {
  id: number;
  name: string;
  role: string | null;
  /** When true, show phone-style avatar instead of initials. */
  isOperator?: boolean;
};

export type NvdaTranscriptWord = {
  text: string;
  startSec: number;
  endSec: number;
};

export type NvdaTranscriptParagraph = {
  speakerId: number;
  text: string;
  /** Start offset in the call audio (seconds). */
  startSec?: number;
  endSec?: number;
  /** Word-level timings when aligned with Whisper words (Quartr-style karaoke). */
  words?: NvdaTranscriptWord[];
};

export type NvdaEarningsTranscript = {
  ticker: "NVDA";
  companyName: string;
  fiscalPeriodLabel: string;
  eventDateYmd: string;
  eventTitle: string;
  sourceUrl?: string;
  /** Public or app-relative URL to archived call audio (mp3/m4a). */
  audioUrl?: string;
  /** Total audio duration when known. */
  durationSec?: number;
  /** `whisper-words` | `whisper-contiguous` | `whisper` | `provisional-word-rate`. */
  audioSync?: string;
  speakers: NvdaTranscriptSpeaker[];
  paragraphs: NvdaTranscriptParagraph[];
};

/** All local NVDA transcript fixtures (newest first). */
export const NVDA_EARNINGS_TRANSCRIPTS: readonly NvdaEarningsTranscript[] = [
  q2_2027,
  q1_2027,
  q4_2026,
  q3_2026,
  q2_2026,
  q1_2026,
] as NvdaEarningsTranscript[];

/** @deprecated Prefer `NVDA_EARNINGS_TRANSCRIPTS` — kept for older imports. */
export const NVDA_Q2_FY2027_TRANSCRIPT = q2_2027 as NvdaEarningsTranscript;
