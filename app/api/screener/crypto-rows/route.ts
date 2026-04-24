import { NextResponse } from "next/server";

import { CACHE_CONTROL_PRIVATE_SCREENER_ROW } from "@/lib/data/cache-policy";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { buildCryptoScreenerApiResponse } from "@/lib/screener/screener-page-payload";
import { SCREENER_MARKETS_PAGE_SIZE } from "@/lib/screener/screener-markets-page-size";

export async function GET(request: Request) {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const page = Math.max(1, Number(url.searchParams.get("page") ?? "1") || 1);
  const pageSizeRaw =
    Number(url.searchParams.get("pageSize") ?? String(SCREENER_MARKETS_PAGE_SIZE)) || SCREENER_MARKETS_PAGE_SIZE;
  const pageSize = Math.min(50, Math.max(1, pageSizeRaw));

  const body = await buildCryptoScreenerApiResponse(page, pageSize);

  return NextResponse.json(body, {
    headers: {
      "Cache-Control": CACHE_CONTROL_PRIVATE_SCREENER_ROW,
    },
  });
}
