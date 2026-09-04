import { NextResponse } from "next/server";

import { CACHE_CONTROL_PRIVATE_SCREENER_ROW } from "@/lib/data/cache-policy";
import { resolveAuthUserFromRequest } from "@/lib/auth/resolve-auth-user";
import { buildCryptoScreenerApiResponse } from "@/lib/screener/screener-page-payload";
import { SCREENER_CRYPTO_PAGE_SIZE } from "@/lib/screener/screener-markets-page-size";

export async function GET(request: Request) {
  const user = await resolveAuthUserFromRequest(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const page = Math.max(1, Number(url.searchParams.get("page") ?? "1") || 1);
  const pageSizeRaw =
    Number(url.searchParams.get("pageSize") ?? String(SCREENER_CRYPTO_PAGE_SIZE)) || SCREENER_CRYPTO_PAGE_SIZE;
  const pageSize = Math.min(100, Math.max(1, pageSizeRaw));

  const body = await buildCryptoScreenerApiResponse(page, pageSize);

  return NextResponse.json(body, {
    headers: {
      "Cache-Control": CACHE_CONTROL_PRIVATE_SCREENER_ROW,
    },
  });
}
