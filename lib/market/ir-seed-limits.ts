/** Shared caps for earnings IR / SEC document resolution (full vs preview requests). */

export const IR_SEED_SLIDE_ROWS_FULL = 16;
export const IR_SEED_SLIDE_ROWS_PREVIEW = 2;

export const IR_SEED_GENERIC_Q4_ROWS_KNOWN_BASE_FULL = 16;
export const IR_SEED_GENERIC_Q4_ROWS_FULL = 16;
export const IR_SEED_GENERIC_Q4_HEAD_PROBES_KNOWN_FULL = 120;
export const IR_SEED_GENERIC_Q4_HEAD_PROBES_FULL = 200;

export const SEC_ENRICHMENT_ROWS_FULL = 16;
export const SEC_ENRICHMENT_INDEX_FETCHES_FULL = 32;

export function irSeedSlideRowCap(preview: boolean): number {
  return preview ? IR_SEED_SLIDE_ROWS_PREVIEW : IR_SEED_SLIDE_ROWS_FULL;
}
