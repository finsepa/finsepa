import type { SearchAssetItem } from "@/lib/search/search-types";

/** Client fetch for `/api/search` — shared by top bar, modal, and news search. */
export async function fetchSearchItems(
  query: string,
  signal?: AbortSignal,
): Promise<SearchAssetItem[]> {
  const q = query.trim();
  if (q.length < 1) return [];

  const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`, { signal });
  if (!res.ok) return [];

  const json = (await res.json()) as { items?: SearchAssetItem[] };
  return Array.isArray(json.items) ? json.items : [];
}
