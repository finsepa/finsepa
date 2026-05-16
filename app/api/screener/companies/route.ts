import { NextResponse } from "next/server";

import { CACHE_CONTROL_PRIVATE_SCREENER_ROW } from "@/lib/data/cache-policy";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { buildScreenerAllStockRowsForGainers, buildScreenerCompaniesApiResponse } from "@/lib/screener/screener-page-payload";
import { SCREENER_COMPANIES_PAGE_SIZE } from "@/lib/screener/screener-markets-page-size";
import {
  parseScreenerIndustryDrill,
  SCREENER_INDUSTRY_QUERY,
  SCREENER_INDUSTRY_SECTOR_QUERY,
} from "@/lib/screener/screener-industry-url";
import { parseScreenerSectorParam, SCREENER_SECTOR_QUERY } from "@/lib/screener/screener-sector-url";

export async function GET(request: Request) {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  if (url.searchParams.get("gainersLosers") === "1") {
    const rows = await buildScreenerAllStockRowsForGainers();
    return NextResponse.json(
      { page: 1, pageSize: rows.length, total: rows.length, rows },
      {
        headers: {
          "Cache-Control": CACHE_CONTROL_PRIVATE_SCREENER_ROW,
        },
      },
    );
  }

  const page = Math.max(1, Number(url.searchParams.get("page") ?? "1") || 1);
  const pageSizeRaw =
    Number(url.searchParams.get("pageSize") ?? String(SCREENER_COMPANIES_PAGE_SIZE)) || SCREENER_COMPANIES_PAGE_SIZE;
  const pageSize = Math.min(50, Math.max(1, pageSizeRaw));
  const sector = parseScreenerSectorParam(url.searchParams.get(SCREENER_SECTOR_QUERY));
  const industryDrill = parseScreenerIndustryDrill(
    url.searchParams.get(SCREENER_INDUSTRY_QUERY),
    url.searchParams.get(SCREENER_INDUSTRY_SECTOR_QUERY),
  );

  const body = await buildScreenerCompaniesApiResponse(page, pageSize, {
    sector: industryDrill ? null : sector,
    industry: industryDrill?.industry ?? null,
    industrySector: industryDrill?.sector ?? null,
  });

  return NextResponse.json(body, {
    headers: {
      "Cache-Control": CACHE_CONTROL_PRIVATE_SCREENER_ROW,
    },
  });
}
