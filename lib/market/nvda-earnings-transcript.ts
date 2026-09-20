/**
 * Back-compat shim — prefer `@/lib/market/earnings-transcript`.
 */
export {
  getNvdaEarningsTranscript,
  hasNvdaEarningsTranscript,
  isNvdaTranscriptTicker,
  listNvdaEarningsTranscripts,
  getEarningsTranscript,
  hasEarningsTranscript,
  listEarningsTranscripts,
} from "@/lib/market/earnings-transcript";
