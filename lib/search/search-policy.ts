/** Client debounce before calling `/api/search` (ms). */
export const SEARCH_CLIENT_DEBOUNCE_MS = 300;

/** Minimum trimmed query length before remote EODHD search runs (local universe still matches at 1 char). */
export const SEARCH_MIN_QUERY_LENGTH = 2;

export function searchQueryMeetsRemoteMinimum(query: string): boolean {
  return query.trim().length >= SEARCH_MIN_QUERY_LENGTH;
}

/** Dropdown view state — spinner until debounce + fetch settle, then results or empty. */
export function getSearchPanelViewState({
  queryTrim,
  debouncedTrim,
  loading,
  resultCount,
}: {
  queryTrim: string;
  debouncedTrim: string;
  loading: boolean;
  resultCount: number;
}) {
  const hasQuery = queryTrim.length > 0;
  const debouncePending = hasQuery && debouncedTrim !== queryTrim;
  const searchPending = hasQuery && (debouncePending || loading);
  const showStaleList = hasQuery && resultCount > 0;
  const noResults =
    hasQuery && !searchPending && debouncedTrim.length >= 1 && resultCount === 0;
  return {
    emptyQuery: !hasQuery,
    searchPending,
    showStaleList,
    noResults,
  };
}
