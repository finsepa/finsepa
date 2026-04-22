import { NextResponse } from "next/server";

import { CACHE_CONTROL_PUBLIC_SEARCH } from "@/lib/data/cache-policy";
import { globalAssetSearch } from "@/lib/search/global-asset-search";
import { isSingleAssetMode, SINGLE_ASSET_SYMBOL } from "@/lib/features/single-asset";
import { TOP10_META } from "@/lib/screener/top10-config";
import { companyLogoUrlForTicker } from "@/lib/screener/company-logo-url";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const q = url.searchParams.get("q") ?? "";

  if (q.trim().length < 1) {
    return NextResponse.json({ items: [] as const });
  }

  if (isSingleAssetMode()) {
    const needle = q.trim().toLowerCase();
    const sym = SINGLE_ASSET_SYMBOL;
    const meta = TOP10_META[sym as keyof typeof TOP10_META];
    if (!meta) return NextResponse.json({ items: [] as const });
    const name = meta.name.toLowerCase();
    if (!sym.toLowerCase().includes(needle) && !name.includes(needle)) {
      return NextResponse.json({ items: [] as const });
    }
    return NextResponse.json({
      items: [
        {
          id: `stock:${sym}`,
          type: "stock",
          symbol: sym,
          name: meta.name,
          subtitle: "US",
          logoUrl: companyLogoUrlForTicker(sym, meta.domain),
          route: `/stock/${encodeURIComponent(sym)}`,
          marketLabel: "US equity",
        },
      ],
    });
  }

  try {
    const items = await globalAssetSearch(q, "all");
    return NextResponse.json(
      { items },
      {
        headers: {
          "Cache-Control": CACHE_CONTROL_PUBLIC_SEARCH,
        },
      },
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : "Search failed";
    return NextResponse.json({ error: message, items: [] }, { status: 500 });
  }
}
