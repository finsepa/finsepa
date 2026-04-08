import { NextResponse } from "next/server";

import { fetchEodhdCryptoOpenPriceOnOrBefore } from "@/lib/market/eodhd-crypto";

type Ctx = { params: Promise<{ symbol: string }> };

export async function GET(request: Request, { params }: Ctx) {
  const { symbol: raw } = await params;
  const date = new URL(request.url).searchParams.get("date");
  const sym = decodeURIComponent(raw).trim();

  if (!sym) {
    return NextResponse.json({ error: "Missing symbol." }, { status: 400 });
  }

  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "Missing or invalid date (use YYYY-MM-DD)." }, { status: 400 });
  }

  const result = await fetchEodhdCryptoOpenPriceOnOrBefore(sym, date);
  if (!result) {
    return NextResponse.json({ price: null, barDate: null, source: null }, { status: 404 });
  }

  return NextResponse.json({
    price: result.price,
    barDate: result.barDate,
    source: result.source,
  });
}
