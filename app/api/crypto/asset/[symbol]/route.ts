import { NextResponse, type NextRequest } from "next/server";

import { getCryptoAsset } from "@/lib/market/crypto-asset";
import { isSingleAssetMode } from "@/lib/features/single-asset";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ symbol: string }> },
) {
  const resolvedParams = await params;
  let symbol = resolvedParams.symbol;
  try {
    symbol = decodeURIComponent(symbol);
  } catch {
    /* invalid encoding — use raw segment */
  }

  if (isSingleAssetMode()) {
    // Single-asset mode disables all crypto market data.
    return NextResponse.json({ row: null }, { status: 200 });
  }

  const row = await getCryptoAsset(symbol);
  if (!row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ row });
}

