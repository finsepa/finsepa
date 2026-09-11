import {
  setPendingAssetShell,
  type PendingAssetShellKind,
} from "@/lib/navigation/pending-asset-shell";
import type { SearchAssetItem } from "@/lib/search/search-types";

function searchTypeToPendingKind(
  type: SearchAssetItem["type"],
): PendingAssetShellKind | null {
  if (type === "stock") return "stock";
  if (type === "crypto") return "crypto";
  if (type === "index") return "index";
  return null;
}

/** Seed optimistic shell before `router.push` from global search. */
export function seedPendingAssetShellFromSearchItem(item: SearchAssetItem): void {
  const kind = searchTypeToPendingKind(item.type);
  if (!kind) return;
  const href = item.route?.trim();
  if (!href) return;
  setPendingAssetShell({
    kind,
    symbol: item.symbol,
    name: item.name,
    logoUrl: item.logoUrl,
    href,
  });
}
