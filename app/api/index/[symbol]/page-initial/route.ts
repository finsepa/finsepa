import { NextResponse } from "next/server";

import { CACHE_CONTROL_PRIVATE_MAX_0_MUST_REVALIDATE } from "@/lib/data/cache-policy";
import { resolveAuthUserFromRequest } from "@/lib/auth/resolve-auth-user";
import { loadIndexPageInitialData } from "@/lib/market/index-page-initial-data";
import { isIndexPageSymbol } from "@/lib/market/index-page-shared";

type Ctx = { params: Promise<{ symbol: string }> };

/**
 * Aggregated index detail payload for native clients (iOS).
 * Reuses SSR `loadIndexPageInitialData` (snapshot + single-flight cold miss).
 * Auth: Bearer or cookie via `resolveAuthUserFromRequest`.
 */
export async function GET(request: Request, { params }: Ctx) {
  const user = await resolveAuthUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { symbol: raw } = await params;
  const routeSymbol = decodeURIComponent(raw).trim().toUpperCase();
  if (!routeSymbol || !isIndexPageSymbol(routeSymbol)) {
    return NextResponse.json({ error: "Unknown index" }, { status: 404 });
  }

  const data = await loadIndexPageInitialData(routeSymbol);

  return NextResponse.json(
    {
      routeSymbol: data.routeSymbol,
      displayName: data.displayName,
      displayCode: data.displayCode,
      performance: {
        price: data.performance.price,
        d1: data.performance.d1,
        m1: data.performance.m1,
        ytd: data.performance.ytd,
        y1: data.performance.y1,
        y5: data.performance.y5,
      },
      // Omit components / news for this slice — overview header + chart + key stats only.
    },
    {
      headers: { "Cache-Control": CACHE_CONTROL_PRIVATE_MAX_0_MUST_REVALIDATE },
    },
  );
}
