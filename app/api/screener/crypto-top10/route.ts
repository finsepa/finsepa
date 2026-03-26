import { NextResponse } from "next/server";

import { getCryptoTop10 } from "@/lib/market/crypto-top10";

export async function GET() {
  const rows = await getCryptoTop10();
  return NextResponse.json({ rows });
}

