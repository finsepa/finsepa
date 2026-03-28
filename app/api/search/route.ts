import { NextResponse } from "next/server";

import { globalAssetSearch } from "@/lib/search/global-asset-search";
import type { SearchScope } from "@/lib/search/search-types";

const SCOPES: SearchScope[] = ["all", "stocks", "crypto", "indices"];

export async function GET(request: Request) {
  const url = new URL(request.url);
  const q = url.searchParams.get("q") ?? "";
  const scopeRaw = (url.searchParams.get("scope") ?? "all").toLowerCase();
  const scope = (SCOPES.includes(scopeRaw as SearchScope) ? scopeRaw : "all") as SearchScope;

  if (q.trim().length < 1) {
    return NextResponse.json({ items: [] as const });
  }

  try {
    const items = await globalAssetSearch(q, scope);
    return NextResponse.json({ items });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Search failed";
    return NextResponse.json({ error: message, items: [] }, { status: 500 });
  }
}
