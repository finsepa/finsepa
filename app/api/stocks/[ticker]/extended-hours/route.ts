import { NextResponse } from "next/server";

import { CACHE_CONTROL_PRIVATE_HOT } from "@/lib/data/cache-policy";
import { resolveAuthUserFromRequest } from "@/lib/auth/resolve-auth-user";
import { getStockExtendedHoursQuoteForApi } from "@/lib/market/stock-extended-hours-header";
import { isUsListedStockHeaderMeta } from "@/lib/market/stock-header-meta";

type Ctx = { params: Promise<{ ticker: string }> };

/** Auth: Bearer or cookie via `resolveAuthUserFromRequest` (native iOS clients). */
export async function GET(request: Request, { params }: Ctx) {
  const user = await resolveAuthUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { ticker } = await params;
  const routeTicker = decodeURIComponent(ticker).trim().toUpperCase();
  if (!routeTicker) {
    return NextResponse.json({ quote: null }, { headers: { "Cache-Control": CACHE_CONTROL_PRIVATE_HOT } });
  }

  const url = new URL(request.url);
  const meta = {
    exchange: url.searchParams.get("exchange"),
    countryIso: url.searchParams.get("country"),
  };
  if (!isUsListedStockHeaderMeta(meta)) {
    return NextResponse.json(
      { ticker: routeTicker, quote: null },
      { headers: { "Cache-Control": CACHE_CONTROL_PRIVATE_HOT } },
    );
  }

  const closeParam = url.searchParams.get("close");
  const sessionCloseUsd =
    closeParam != null && closeParam.trim() !== "" ? Number(closeParam) : null;

  const quote = await getStockExtendedHoursQuoteForApi(
    routeTicker,
    meta,
    sessionCloseUsd != null && Number.isFinite(sessionCloseUsd) && sessionCloseUsd > 0
      ? sessionCloseUsd
      : null,
  );

  return NextResponse.json(
    { ticker: routeTicker, quote },
    { headers: { "Cache-Control": CACHE_CONTROL_PRIVATE_HOT } },
  );
}
