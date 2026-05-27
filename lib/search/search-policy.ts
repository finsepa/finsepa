/** Client debounce before calling `/api/search` (ms). */
export const SEARCH_CLIENT_DEBOUNCE_MS = 300;

/** Minimum trimmed query length before remote EODHD search runs (local universe still matches at 1 char). */
export const SEARCH_MIN_QUERY_LENGTH = 2;

export function searchQueryMeetsRemoteMinimum(query: string): boolean {
  return query.trim().length >= SEARCH_MIN_QUERY_LENGTH;
}
