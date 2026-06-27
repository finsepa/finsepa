import type { SuperinvestorRegistryItem } from "@/lib/superinvestors/superinvestor-registry";
import type { SearchAssetItem } from "@/lib/search/search-types";

function norm(s: string): string {
  return s.trim().toLowerCase();
}

export function superinvestorSearchItem(entry: SuperinvestorRegistryItem): SearchAssetItem {
  const fundLabel = entry.fundNameOverride?.trim() || null;
  return {
    id: `superinvestor:${entry.slug}`,
    type: "superinvestor",
    symbol: fundLabel ?? entry.managerName,
    name: entry.managerName,
    subtitle: fundLabel,
    logoUrl: entry.avatarSrc,
    route: `/superinvestors/${entry.slug}`,
    marketLabel: "Superinvestor",
  };
}

export function superinvestorMatchesQuery(entry: SuperinvestorRegistryItem, query: string): boolean {
  const n = norm(query);
  if (!n) return false;
  if (norm(entry.managerName).includes(n)) return true;
  if (entry.fundNameOverride && norm(entry.fundNameOverride).includes(n)) return true;
  const slugWords = norm(entry.slug.replace(/-/g, " "));
  if (slugWords.includes(n)) return true;
  const slugCompact = entry.slug.replace(/-/g, "");
  if (slugCompact.includes(n.replace(/\s+/g, ""))) return true;
  return false;
}

export function scoreSuperinvestorMatch(
  entry: SuperinvestorRegistryItem,
  query: string,
  scoreItem: (name: string, symbol: string, type: SearchAssetItem["type"]) => number,
): number {
  const item = superinvestorSearchItem(entry);
  let score = scoreItem(item.name, item.symbol, item.type);
  const n = norm(query);
  const slugWords = norm(entry.slug.replace(/-/g, " "));
  if (slugWords === n) score = Math.max(score, 920);
  else if (slugWords.startsWith(n)) score = Math.max(score, 820);
  else if (slugWords.includes(n)) score = Math.max(score, 620);
  if (entry.fundNameOverride) {
    score = Math.max(score, scoreItem(entry.fundNameOverride, item.symbol, item.type));
  }
  return score;
}
