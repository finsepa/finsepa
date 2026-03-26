import { NextResponse, type NextRequest } from "next/server";

import { getCryptoAsset } from "@/lib/market/crypto-asset";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ symbol: string }> },
) {
  const resolvedParams = await params;
  const symbol = resolvedParams.symbol;
  const row = await getCryptoAsset(symbol);
  if (!row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ row });
}

