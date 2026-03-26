import { NextResponse } from "next/server";

import { getIndicesTop10 } from "@/lib/market/indices-top10";

export async function GET() {
  const rows = await getIndicesTop10();
  return NextResponse.json({ rows });
}

