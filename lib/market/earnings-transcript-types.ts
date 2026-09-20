/**
 * Shared earnings-call transcript types (NVDA, AAPL, GOOGL, …).
 */

export type EarningsTranscriptSpeaker = {
  id: number;
  name: string;
  role: string | null;
  /** When true, show phone-style avatar instead of initials. */
  isOperator?: boolean;
};

export type EarningsTranscriptWord = {
  text: string;
  startSec: number;
  endSec: number;
};

export type EarningsTranscriptParagraph = {
  speakerId: number;
  text: string;
  /** Start offset in the call audio (seconds). */
  startSec?: number;
  endSec?: number;
  /** Word-level timings when aligned with Whisper words (Quartr-style karaoke). */
  words?: EarningsTranscriptWord[];
};

export type EarningsTranscript = {
  ticker: string;
  companyName: string;
  fiscalPeriodLabel: string;
  eventDateYmd: string;
  eventTitle: string;
  sourceUrl?: string;
  /** Public or app-relative URL to archived call audio (mp3/m4a). */
  audioUrl?: string;
  /** Total audio duration when known. */
  durationSec?: number;
  /** `whisper-words` | `whisper-contiguous` | `whisper` | `stockanalysis-sentences` | … */
  audioSync?: string;
  speakers: EarningsTranscriptSpeaker[];
  paragraphs: EarningsTranscriptParagraph[];
};

/** @deprecated Prefer EarningsTranscript* aliases. */
export type NvdaTranscriptSpeaker = EarningsTranscriptSpeaker;
/** @deprecated Prefer EarningsTranscript* aliases. */
export type NvdaTranscriptWord = EarningsTranscriptWord;
/** @deprecated Prefer EarningsTranscript* aliases. */
export type NvdaTranscriptParagraph = EarningsTranscriptParagraph;
/** @deprecated Prefer EarningsTranscript. */
export type NvdaEarningsTranscript = EarningsTranscript & { ticker: "NVDA" | string };
