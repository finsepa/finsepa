import { NextResponse } from "next/server";

import { CACHE_CONTROL_PRIVATE_HOT } from "@/lib/data/cache-policy";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getStockExtendedHoursQuoteForApi } from "@/lib/market/stock-extended-hours-header";
import { isUsListedStockHeaderMeta } from "@/lib/market/stock-header-meta";

type Ctx = { params: Promise<{ ticker: string }> };

export async function GET(request: Request, { params }: Ctx) {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

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
