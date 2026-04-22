import { NextResponse } from "next/server";

import { CACHE_CONTROL_PRIVATE_EARNINGS_PREVIEW, CACHE_CONTROL_PRIVATE_EARNINGS_PREVIEW_SINGLE } from "@/lib/data/cache-policy";
import { isTickerOnScreenerEarningsUniverse } from "@/lib/market/earnings-week-data";
import { getEarningsPreviewPayload } from "@/lib/market/earnings-preview";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { isSingleAssetMode, SINGLE_ASSET_SYMBOL } from "@/lib/features/single-asset";

const TICKER_RE = /^[A-Z0-9.\-]{1,32}$/i;

export async function GET(request: Request) {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const tickerRaw = url.searchParams.get("ticker")?.trim() ?? "";
  const reportDate = url.searchParams.get("reportDate")?.trim() ?? "";
  const fallbackName = url.searchParams.get("companyName")?.trim() ?? tickerRaw;
  const fallbackLogo = url.searchParams.get("logoUrl")?.trim() ?? "";

  if (!tickerRaw || !TICKER_RE.test(tickerRaw)) {
    return NextResponse.json({ error: "Invalid ticker" }, { status: 400 });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(reportDate)) {
    return NextResponse.json({ error: "Invalid reportDate" }, { status: 400 });
  }

  if (!(await isTickerOnScreenerEarningsUniverse(tickerRaw))) {
    return NextResponse.json({ error: "Symbol not on screener" }, { status: 404 });
  }

  if (isSingleAssetMode()) {
    const tickerUpper = tickerRaw.toUpperCase();
    if (tickerUpper === SINGLE_ASSET_SYMBOL) {
      return NextResponse.json(
        {
          ticker: tickerUpper,
          companyName: fallbackName || tickerUpper,
          logoUrl: fallbackLogo || null,
          earningsDateDisplay: reportDate,
          estRevenueDisplay: null,
          estEpsDisplay: null,
        },
        { headers: { "Cache-Control": CACHE_CONTROL_PRIVATE_EARNINGS_PREVIEW_SINGLE } },
      );
    }

    // Unsupported ticker in NVDA-only mode.
    return NextResponse.json(
      {
        ticker: tickerUpper,
        companyName: fallbackName || tickerUpper,
        logoUrl: fallbackLogo || null,
        earningsDateDisplay: reportDate,
        estRevenueDisplay: null,
        estEpsDisplay: null,
      },
      { headers: { "Cache-Control": CACHE_CONTROL_PRIVATE_EARNINGS_PREVIEW_SINGLE } },
    );
  }

  const payload = await getEarningsPreviewPayload({
    ticker: tickerRaw.toUpperCase(),
    reportDateYmd: reportDate,
    fallbackCompanyName: fallbackName || tickerRaw,
    fallbackLogoUrl: fallbackLogo,
  });

  return NextResponse.json(payload, {
    headers: {
      "Cache-Control": CACHE_CONTROL_PRIVATE_EARNINGS_PREVIEW,
    },
  });
}
