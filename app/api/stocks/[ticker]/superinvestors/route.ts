import { NextResponse } from "next/server";

import { CACHE_CONTROL_PUBLIC_WARM } from "@/lib/data/cache-policy";
import { getStockDetailHeaderMetaForPage } from "@/lib/market/stock-header-meta-server";
import { getStockSuperinvestorPositions } from "@/lib/superinvestors/stock-superinvestor-positions";

function normalizeName(s: string): string {
  return s
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\b(inc|incorporated|corp|corporation|co|company|ltd|limited|plc|del|holdings)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export async function GET(_req: Request, ctx: { params: Promise<{ ticker: string }> }) {
  const { ticker } = await ctx.params;
  const sym = decodeURIComponent(ticker).trim().toUpperCase();
  if (!sym) {
    return NextResponse.json({ ticker: "", positions: [] });
  }

  let payload = await getStockSuperinvestorPositions(sym);

  if (payload.positions.length === 0) {
    const header = await getStockDetailHeaderMetaForPage(sym);
    const companyNameNorm = header.fullName ? normalizeName(header.fullName) : null;
    if (companyNameNorm) {
      payload = await getStockSuperinvestorPositions(sym, companyNameNorm);
    }
  }

  return NextResponse.json(payload, {
    headers: { "Cache-Control": CACHE_CONTROL_PUBLIC_WARM },
  });
}
